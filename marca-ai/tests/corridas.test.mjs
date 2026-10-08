// Testes do ciclo da corrida pela interface (criarCorridas), com o armazém do aparelho
// numa memória falsa e um relógio controlado. Rode: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCorridas } from '../js/corridas.js';
import { armazemLocal } from '../js/armazens.js';

function montar() {
  let estado = { calls: [], posicao: null };
  const loja = {
    S: () => estado,
    transacao(fn) { const copia = structuredClone(estado); if (fn(copia) === false) return false; estado = copia; return true; }
  };
  let t = Date.UTC(2026, 9, 8, 12, 0);
  const relogio = { agora: () => t, passar: min => { t += min * 60000; } };
  return { corridas: criarCorridas(armazemLocal(loja), relogio), estado: () => estado, relogio };
}
const LOJA = { lat: -20.37745, lon: -43.41623 };
const pedido = (extra = {}) => ({ empresa: 'Padaria', coleta: 'Praça Gomes Freire, 10', entrega: 'Rua Dom Silvério, 200, Centro', km: 5, lojaGeo: LOJA, ...extra });
const joao = { nome: 'João', moto: 'CG 160', placa: 'ABC1D23' };

test('ciclo completo: chamar, aceitar, chegar, pegar (com espera paga) e entregar com o código', async () => {
  const { corridas, estado, relogio } = montar();
  const { id } = await corridas.chamar(pedido());
  const c0 = estado().calls[0];
  assert.equal(c0.valor, 12);
  assert.match(c0.codigo, /^\d{4}$/);
  assert.deepEqual(await corridas.aceitar(id, joao), { ok: true });
  assert.equal((await corridas.avancar(id)).etapa, 'coleta');
  relogio.passar(14);
  const coleta = await corridas.avancar(id);
  assert.deepEqual([coleta.etapa, coleta.espera], ['coletado', 2]);
  assert.equal((await corridas.avancar(id, { codigo: c0.codigo })).etapa, 'entregue');
  assert.equal(estado().calls[0].status, 'entregue');
  assert.equal((await corridas.avancar(id)).motivo, 'indisponivel');
});

test('chamado já aceito não pode ser aceito de novo; motoboy com corrida em andamento fica ocupado', async () => {
  const { corridas } = montar();
  const a = await corridas.chamar(pedido());
  const b = await corridas.chamar(pedido());
  await corridas.aceitar(a.id, joao);
  assert.equal((await corridas.aceitar(a.id, joao)).motivo, 'indisponivel');
  assert.equal((await corridas.aceitar(b.id, joao)).motivo, 'ocupado');
});

test('código errado conta tentativas e bloqueia por 2 minutos na quinta', async () => {
  const { corridas, estado, relogio } = montar();
  const { id } = await corridas.chamar(pedido());
  await corridas.aceitar(id, joao); await corridas.avancar(id); await corridas.avancar(id);
  const certo = estado().calls[0].codigo, errado = certo === '1111' ? '2222' : '1111';
  assert.deepEqual(await corridas.avancar(id, { codigo: errado }), { ok: false, motivo: 'codigo-errado', restam: 4 });
  for (let i = 0; i < 3; i++) await corridas.avancar(id, { codigo: errado });
  assert.equal((await corridas.avancar(id, { codigo: errado })).motivo, 'bloqueado');
  assert.equal((await corridas.avancar(id, { codigo: certo })).motivo, 'bloqueado');
  relogio.passar(2.1);
  assert.equal((await corridas.avancar(id, { codigo: certo })).ok, true);
  assert.equal((await corridas.avancar(id, { codigo: 'abcd' })).motivo, 'indisponivel');
});

test('GPS soma o km e registra a chegada sozinho perto da loja', async () => {
  const { corridas, estado } = montar();
  const { id } = await corridas.chamar(pedido());
  await corridas.aceitar(id, joao);
  assert.deepEqual(await corridas.noGps({ lat: -20.3705, lon: -43.4215 }, 0.4), { ok: true });
  assert.equal(estado().posicao.lat, -20.3705);
  const r = await corridas.noGps({ lat: -20.3774, lon: -43.4163 }, 0.5);
  assert.deepEqual(r, { ok: true, chegouNa: 'Padaria' });
  const c = estado().calls[0];
  assert.deepEqual([c.status, c.chegadaGps, c.kmReal], ['coleta', true, 0.9]);
});

test('cancelar paga deslocamento só se o motoboy já aceitou; depois de pegar o pedido não cancela', async () => {
  const { corridas } = montar();
  const a = await corridas.chamar(pedido());
  assert.equal((await corridas.cancelar(a.id)).compensacao, 0);
  const b = await corridas.chamar(pedido());
  await corridas.aceitar(b.id, joao);
  assert.equal((await corridas.cancelar(b.id)).compensacao, 5);
  const c = await corridas.chamar(pedido());
  await corridas.aceitar(c.id, joao); await corridas.avancar(c.id); await corridas.avancar(c.id);
  assert.equal((await corridas.cancelar(c.id)).motivo, 'indisponivel');
});

test('gorjeta e avaliação: só depois da entrega, uma vez, com valores válidos', async () => {
  const { corridas, estado } = montar();
  const { id } = await corridas.chamar(pedido());
  assert.equal((await corridas.gorjeta(id, 5)).motivo, 'indisponivel');
  await corridas.aceitar(id, joao); await corridas.avancar(id); await corridas.avancar(id);
  await corridas.avancar(id, { codigo: estado().calls[0].codigo });
  assert.equal((await corridas.gorjeta(id, 7)).motivo, 'invalido');
  assert.equal((await corridas.gorjeta(id, 5)).ok, true);
  assert.equal((await corridas.gorjeta(id, 2)).motivo, 'indisponivel');
  assert.equal((await corridas.avaliar(id, 5, ['Pedido estava pronto'])).ok, true);
  assert.equal((await corridas.avaliar(id, 3)).motivo, 'indisponivel');
});

test('dados inválidos não viram chamado', async () => {
  const { corridas, estado } = montar();
  assert.equal((await corridas.chamar(pedido({ km: 500 }))).motivo, 'invalido');
  assert.equal((await corridas.chamar(pedido({ entrega: '' }))).motivo, 'invalido');
  assert.equal(estado().calls.length, 0);
});

test('empresa libera novas tentativas depois do bloqueio do código', async () => {
  const { corridas, estado } = montar();
  const { id } = await corridas.chamar(pedido());
  await corridas.aceitar(id, joao); await corridas.avancar(id); await corridas.avancar(id);
  const certo = estado().calls[0].codigo, errado = certo === '1111' ? '2222' : '1111';
  for (let i = 0; i < 5; i++) await corridas.avancar(id, { codigo: errado });
  assert.equal((await corridas.avancar(id, { codigo: certo })).motivo, 'bloqueado');
  assert.equal((await corridas.liberarCodigo(id)).ok, true);
  assert.equal((await corridas.avancar(id, { codigo: certo })).ok, true);
  assert.equal((await corridas.liberarCodigo(id)).motivo, 'indisponivel');
});
