// Raio de atuação, despacho em ondas e cercas de GPS (estrutura copiada de Uber Flash, 99 e iFood).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raioOnda, alcance, perto, gradeAproximada, disponiveisNoRaio, ONDA_MS } from '../js/regras.js';
import { limparPerfil, limparEmpresa, limparChamado } from '../js/esquema.js';
import { criarCorridas } from '../js/corridas.js';
import { armazemLocal } from '../js/armazens.js';

const LOJA = { lat: -20.37745, lon: -43.41623 };          // Praça Gomes Freire, Mariana
const T0 = Date.UTC(2026, 9, 13, 12, 0);
const aKm = km => ({ lat: LOJA.lat + km / 111.2 / 1.35, lon: LOJA.lon }); // ponto a ~km pelas ruas ao norte

test('onda começa em 2 km e cresce a cada 30 s até o raio da loja', () => {
  const c = { criadoEm: T0, raioKm: 8 };
  assert.equal(raioOnda(c, T0), 2);
  assert.equal(raioOnda(c, T0 + ONDA_MS), 4);
  assert.equal(raioOnda(c, T0 + 2 * ONDA_MS), 8);
  assert.equal(raioOnda(c, T0 + 10 * ONDA_MS), 8, 'nunca passa do limite da loja');
  assert.equal(raioOnda({ criadoEm: T0, raioKm: 15 }, T0 + 10 * ONDA_MS), 15);
  assert.equal(raioOnda({ criadoEm: T0, raioKm: 999 }, T0 + 10 * ONDA_MS), 5, 'raio inválido vira o padrão');
});

test('janela dos favoritos segura as ondas', () => {
  const c = { criadoEm: T0, prioridadeAte: T0 + 30000, raioKm: 15 };
  assert.equal(raioOnda(c, T0 + 45000), 2);
  assert.equal(raioOnda(c, T0 + 61000), 4);
});

test('alcance: respeita o raio do motoboy e a onda; sem GPS ou sem loja, não filtra', () => {
  const c = { criadoEm: T0, raioKm: 15, lojaGeo: LOJA };
  assert.equal(alcance(c, aKm(1.5), 5, T0).ok, true);
  assert.equal(alcance(c, aKm(3), 5, T0).ok, false, 'fora da 1ª onda (2 km)');
  assert.equal(alcance(c, aKm(3), 5, T0 + ONDA_MS).ok, true, '2ª onda chega a 4 km');
  assert.equal(alcance(c, aKm(7), 5, T0 + 9 * ONDA_MS).ok, false, 'fora do raio que o motoboy escolheu');
  assert.deepEqual(alcance(c, null, 5, T0), { ok: true, km: null });
  assert.deepEqual(alcance({ criadoEm: T0 }, aKm(30), 2, T0), { ok: true, km: null });
});

test('cerca: perto() em metros', () => {
  assert.equal(perto(LOJA, aKm(0.05), 120), true);
  assert.equal(perto(LOJA, aKm(1), 120), false);
  assert.equal(perto(LOJA, null, 120), false);
});

test('posição de disponível é aproximada (~1 km) e conta só quem está no raio', () => {
  const g = gradeAproximada({ lat: -20.377451, lon: -43.416239 });
  assert.deepEqual(g, { latC: -2038, lonC: -4342 });
  assert.ok(Number.isInteger(g.latC) && Number.isInteger(g.lonC));
  const lista = [gradeAproximada(LOJA), gradeAproximada(aKm(2)), gradeAproximada({ lat: -20.0, lon: -43.4 })];
  assert.equal(disponiveisNoRaio(lista, LOJA, 3), 2);
  assert.equal(disponiveisNoRaio(lista, null, 3), null);
});

test('esquema: raio só aceita os valores do app', () => {
  assert.equal(limparPerfil({ raio: 10 }).raio, 10);
  assert.equal(limparPerfil({ raio: 7 }).raio, 5);
  assert.equal(limparEmpresa({ raioBusca: '15' }).raioBusca, 15);
  assert.equal(limparEmpresa({ raioBusca: -1 }).raioBusca, 5);
  assert.equal(limparChamado({ id: 'a', status: 'aberto', raioKm: 8 }).raioKm, 8);
  assert.equal(limparChamado({ id: 'a', status: 'aberto', raioKm: 100 }).raioKm, 5);
});

test('ciclo: chamado guarda o raio da loja e avisa uma vez quando o motoboy chega perto do cliente', async () => {
  let estado = { calls: [], posicao: null };
  const loja = { S: () => estado, transacao(fn) { const c = structuredClone(estado); if (fn(c) === false) return false; estado = c; return true; } };
  const corridas = criarCorridas(armazemLocal(loja), { agora: () => T0 });
  const CLIENTE = aKm(3);
  const { id } = await corridas.chamar({ empresa: 'Padaria', coleta: 'Praça', entrega: 'Rua', km: 3, lojaGeo: LOJA, clienteGeo: CLIENTE, raioKm: 8 });
  assert.equal(estado.calls[0].raioKm, 8);
  await corridas.aceitar(id, { nome: 'João' });
  await corridas.noGps(LOJA, 0);                       // chegada automática na loja
  await corridas.avancar(id);                           // pegou o pedido
  assert.equal((await corridas.noGps(aKm(1.5), 0)).chegandoCliente, false);
  assert.equal((await corridas.noGps(CLIENTE, 0)).chegandoCliente, true);
  assert.equal((await corridas.noGps(CLIENTE, 0)).chegandoCliente, false, 'avisa só uma vez');
});
