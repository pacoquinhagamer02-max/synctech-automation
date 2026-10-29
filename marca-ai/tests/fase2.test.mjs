// Fase 2 (29/10/2026): várias paradas, motoboy por turno e relatório da loja.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frete, ordenarParadas, kmRota, paradaAtual, nParadas, conferirTurno, valorTurno, ganhoTurno, turnoAgora, saldo, relatorioEmpresa, csvEmpresa } from '../js/regras.js';
import { limparChamado, limparTurno } from '../js/esquema.js';
import { criarCorridas } from '../js/corridas.js';
import { criarTurnos } from '../js/turnos.js';
import { armazemLocal } from '../js/armazens.js';

function montar() {
  let estado = { calls: [], turnos: [], posicao: null };
  const loja = {
    S: () => estado,
    transacao(fn) { const copia = structuredClone(estado); if (fn(copia) === false) return false; estado = copia; return true; }
  };
  let t = Date.UTC(2026, 9, 29, 15, 0);
  const relogio = { agora: () => t, passar: min => { t += min * 60000; } };
  const armazem = armazemLocal(loja);
  return { corridas: criarCorridas(armazem, relogio), turnos: criarTurnos(armazem, relogio), estado: () => estado, relogio };
}
const LOJA = { lat: -20.37745, lon: -43.41623 };
const joao = { nome: 'João', moto: 'CG 160', placa: 'ABC1D23' };

test('cada parada além da primeira paga R$ 3; a volta não multiplica as paradas', () => {
  assert.equal(frete(5, false, false, 1), 12);
  assert.equal(frete(5, false, false, 3), 18);
  assert.equal(frete(5, false, true, 2), 21);  // ida 12 × 1,5 + 3
  assert.equal(frete(5, false, false, 99), 24, 'no máximo 5 paradas');
});

test('rota passa sempre pela parada mais perto; sem mapa vai pro fim', () => {
  const longe = { entrega: 'longe', clienteGeo: { lat: -20.40, lon: -43.41623 } };
  const perto = { entrega: 'perto', clienteGeo: { lat: -20.38, lon: -43.41623 } };
  const meio = { entrega: 'meio', clienteGeo: { lat: -20.39, lon: -43.41623 } };
  const sem = { entrega: 'sem mapa', clienteGeo: null };
  assert.deepEqual(ordenarParadas(LOJA, [longe, sem, perto, meio]).map(p => p.entrega), ['perto', 'meio', 'longe', 'sem mapa']);
  assert.ok(kmRota(LOJA, [perto, meio, longe]) > 3);
  assert.equal(kmRota(LOJA, [perto, sem]), null);
});

test('corrida com 3 paradas: cada cliente tem o seu código e a corrida só termina na última', async () => {
  const { corridas, estado } = montar();
  const { id } = await corridas.chamar({ empresa: 'Pizzaria', coleta: 'Rua A, 1', km: 6, lojaGeo: LOJA, paradas: [
    { entrega: 'Rua 1', cliente: 'Ana' }, { entrega: 'Rua 2', cliente: 'Bia', cobranca: 'dinheiro', cobrar: 40, troco: 50 }, { entrega: 'Rua 3', cliente: 'Caio' }] });
  const c0 = estado().calls[0];
  assert.equal(c0.valor, frete(6, false, false, 3));
  assert.equal(new Set(c0.paradas.map(p => p.codigo)).size >= 1, true);
  assert.equal(new Set(c0.paradas.map(p => p.rastreio)).size, 3, 'um link por cliente');
  await corridas.aceitar(id, joao);
  await corridas.avancar(id); await corridas.avancar(id);
  const errado = c0.paradas[1].codigo === '1111' ? '2222' : '1111';
  const r0 = await corridas.avancar(id, { codigo: c0.paradas[0].codigo === errado ? '3333' : errado });
  if (c0.paradas[0].codigo !== errado) assert.equal(r0.motivo, 'codigo-errado', 'código de outro cliente não vale');
  const r1 = await corridas.avancar(id, { codigo: c0.paradas[0].codigo });
  assert.deepEqual([r1.etapa, r1.feitas, r1.total], ['parada', 1, 3]);
  const c1 = limparChamado(estado().calls[0]);
  assert.equal(c1.status, 'coletado');
  assert.equal(paradaAtual(c1), 1);
  assert.equal(c1.cliente, 'Bia', 'campos de cima mostram a parada atual');
  assert.equal(c1.cobrar, 40);
  assert.ok(c1.paradas[0].entregueEm);
  assert.equal((await corridas.avancar(id, { codigo: c0.paradas[1].codigo })).etapa, 'parada');
  assert.equal((await corridas.avancar(id, { codigo: c0.paradas[2].codigo })).etapa, 'entregue');
  assert.equal(estado().calls[0].status, 'entregue');
  assert.equal(estado().calls[0].entregues, 3);
});

test('chamado antigo (sem lista de paradas) continua funcionando como uma parada', () => {
  const c = limparChamado({ id: 'x', status: 'aberto', empresa: 'Loja', coleta: 'A', entrega: 'B', cliente: 'Ana', km: 5, codigo: '1234' });
  assert.equal(nParadas(c), 1);
  assert.equal(c.paradas[0].codigo, '1234');
  assert.equal(c.valor, 12);
  assert.equal(limparChamado({ id: 'y', status: 'aberto', km: 5, paradas: Array(9).fill({ entrega: 'X' }) }).paradas.length, 5);
});

test('turno: conferência de horário e valor', () => {
  const agora = Date.UTC(2026, 9, 29, 15, 0), h = 3600000;
  assert.equal(conferirTurno({ inicio: agora + h, fim: agora + 5 * h, valorHora: 15 }, agora), '');
  assert.match(conferirTurno({ inicio: agora + h, fim: agora + 2 * h, valorHora: 15 }, agora), /de 2 a 12 horas/);
  assert.match(conferirTurno({ inicio: agora + h, fim: agora + 4 * h, valorHora: 8 }, agora), /valor por hora/);
  assert.match(conferirTurno({ inicio: agora - h, fim: agora + 4 * h, valorHora: 15 }, agora), /daqui pra frente/);
  assert.equal(valorTurno({ inicio: 0, fim: 4 * h, valorHora: 15.5 }), 62);
});

test('turno: reservar, aceitar, não cruzar dois, concluir paga e entra no saldo', async () => {
  const { turnos, estado, relogio } = montar();
  const h = 3600000, ini = relogio.agora() + h;
  const a = await turnos.reservar({ empresa: 'Pizzaria', coleta: 'Rua A', inicio: ini, fim: ini + 4 * h, valorHora: 15 });
  const b = await turnos.reservar({ empresa: 'Lanche', coleta: 'Rua B', inicio: ini + 2 * h, fim: ini + 6 * h, valorHora: 18 });
  assert.equal((await turnos.reservar({ empresa: 'X', coleta: 'Y', inicio: ini, fim: ini + h, valorHora: 15 })).motivo, 'invalido');
  assert.deepEqual(await turnos.aceitar(a.id, joao), { ok: true });
  assert.equal((await turnos.aceitar(b.id, joao)).motivo, 'ocupado', 'turnos que se cruzam');
  assert.equal((await turnos.concluir(a.id)).motivo, 'indisponivel', 'só depois do horário');
  relogio.passar(90);
  assert.equal(turnoAgora(estado().turnos, 'Pizzaria', relogio.agora())?.id, a.id);
  relogio.passar(240);
  assert.deepEqual(await turnos.concluir(a.id), { ok: true });
  const t = limparTurno(estado().turnos.find(x => x.id === a.id));
  assert.equal(ganhoTurno(t), 60);
  assert.equal(saldo([], [], estado().turnos), 60);
});

test('turno: loja desmarca depois do aceite e paga 1 hora; antes do aceite, de graça', async () => {
  const { turnos } = montar();
  const ini = Date.UTC(2026, 9, 29, 18, 0), h = 3600000;
  const a = await turnos.reservar({ empresa: 'P', coleta: 'R', inicio: ini, fim: ini + 3 * h, valorHora: 20 });
  const b = await turnos.reservar({ empresa: 'P', coleta: 'R', inicio: ini + 4 * h, fim: ini + 7 * h, valorHora: 20 });
  assert.equal((await turnos.cancelar(b.id)).compensacao, 0);
  await turnos.aceitar(a.id, joao);
  assert.equal((await turnos.cancelar(a.id)).compensacao, 20);
  assert.equal(ganhoTurno({ status: 'cancelado', compensacao: 20 }), 20);
});

test('relatório da loja: gasto, custo por entrega, tempos e quem mais entregou', () => {
  const t0 = Date.UTC(2026, 9, 10, 15, 0), m = 60000;
  const base = { empresa: 'Pizzaria', coleta: 'A', entrega: 'B', km: 5, status: 'entregue', motoboy: 'João', taxa: 1.99 };
  const calls = [
    limparChamado({ ...base, id: '1', criadoEm: t0, aceitoEm: t0 + 2 * m, chegouEm: t0 + 8 * m, coletouEm: t0 + 12 * m, entregueEm: t0 + 25 * m, espera: 0, gorjeta: 5 }),
    limparChamado({ ...base, id: '2', criadoEm: t0 + 60 * m, aceitoEm: t0 + 64 * m, coletouEm: t0 + 70 * m, entregueEm: t0 + 90 * m, motoboy: 'Ana', paradas: [{ entrega: 'X' }, { entrega: 'Y' }] }),
    limparChamado({ ...base, id: '3', criadoEm: t0, status: 'cancelado', motoboy: '' }),
    limparChamado({ ...base, id: '4', criadoEm: t0, empresa: 'Outra' })
  ];
  const r = relatorioEmpresa(calls, 'Pizzaria', t0 - m, t0 + 1000 * m);
  assert.equal(r.chamados, 3);
  assert.equal(r.entregues, 2);
  assert.equal(r.paradas, 3);
  assert.equal(r.semMotoboy, 1);
  assert.equal(r.frete, 12 + 15);
  assert.equal(r.gasto, 12 + 15 + 5 + 1.99 * 2);
  assert.equal(r.custoPorEntrega, Math.round(r.gasto / 3 * 100) / 100);
  assert.equal(r.minAceite, 3);
  assert.equal(r.motoboys[0].nome, 'Ana');
  const csv = csvEmpresa([...calls, limparChamado({ ...base, id: '5', criadoEm: t0, motoboy: '=HYPERLINK("x")' })], 'Pizzaria', t0 - m, t0 + 1000 * m);
  assert.equal(csv.split('\r\n').length, 5);
  assert.match(csv, /"'=HYPERLINK/, 'fórmula vira texto na planilha');
});
