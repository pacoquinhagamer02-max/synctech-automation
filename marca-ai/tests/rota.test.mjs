// Rota pelas ruas, map matching, recálculo, tempo de chegada e filtro do GPS (modelo Uber/iFood).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projetarNaRota, etaRotaMin, deveRecalcular, criarFiltroGps, rumoDe, buscarRota, DESVIO_RECALCULA_M, INTERVALO_RECALCULO_MS } from '../js/rota.js';

const LOJA = { lat: -20.37745, lon: -43.41623 };            // Praça Gomes Freire, Mariana
const m = (dLatM, dLonM) => ({ lat: LOJA.lat + dLatM / 110540, lon: LOJA.lon + dLonM / (111320 * Math.cos(LOJA.lat * Math.PI / 180)) });
// Rota em L: 500 m pro norte, depois 500 m pro leste.
const ROTA = [m(0, 0), m(500, 0), m(500, 500)];

test('projeta a moto na rota: desvio, quanto falta e rumo do trecho', () => {
  const p = projetarNaRota(ROTA, m(200, 20));
  assert.ok(Math.abs(p.desvioM - 20) < 1, `desvio ${p.desvioM}`);
  assert.ok(Math.abs(p.restanteKm - 0.8) < 0.005, `falta ${p.restanteKm}`);
  assert.equal(p.indice, 0);
  assert.ok(Math.abs(p.rumo - 0) < 1, 'primeiro trecho vai pro norte');
  const q = projetarNaRota(ROTA, m(510, 300));
  assert.equal(q.indice, 1);
  assert.ok(Math.abs(q.restanteKm - 0.2) < 0.005);
  assert.ok(Math.abs(q.rumo - 90) < 1, 'segundo trecho vai pro leste');
  assert.equal(projetarNaRota([LOJA], LOJA), null);
  assert.equal(projetarNaRota(null, LOJA), null);
});

test('tempo de chegada é a parte da duração que falta', () => {
  const rota = { km: 4, min: 12 };
  assert.equal(etaRotaMin(rota, 4), 12);
  assert.equal(etaRotaMin(rota, 1), 3);
  assert.equal(etaRotaMin(rota, 0), 1, 'nunca mostra 0 min');
  assert.equal(etaRotaMin(rota, 9), 12, 'fora da rota não passa da duração total');
  assert.equal(etaRotaMin({ km: 0, min: 0 }, 1), null);
});

test('recalcula só fora da rota, em leituras seguidas e sem pedir toda hora', () => {
  const base = { desvioM: DESVIO_RECALCULA_M + 10, foraSeguidas: 2, ultimoPedido: 0, agora: INTERVALO_RECALCULO_MS };
  assert.equal(deveRecalcular(base), true);
  assert.equal(deveRecalcular({ ...base, desvioM: 30 }), false, 'dentro da rota');
  assert.equal(deveRecalcular({ ...base, foraSeguidas: 1 }), false, 'uma leitura ruim só não basta');
  assert.equal(deveRecalcular({ ...base, ultimoPedido: base.agora - 1000 }), false, 'acabou de pedir');
});

test('filtro de Kalman: parado, a tremida some; andando, acompanha', () => {
  const f = criarFiltroGps();
  let ult;
  const tremidas = [[15, -10], [-12, 14], [10, 12], [-14, -9], [12, -13], [-10, 10]];
  tremidas.forEach(([a, b], i) => { ult = f({ ...m(a, b), precisao: 20, em: 1000 * (i + 1) * 3 }); });
  const longe = projetarNaRota([m(-1, 0), m(1, 0)], ult);
  assert.ok(Math.hypot(longe.desvioM) < 12, `parado ficou a ${longe.desvioM} m do ponto real`);

  const g = criarFiltroGps();
  let p;
  for (let i = 0; i <= 10; i++) p = g({ ...m(i * 50, 0), precisao: 10, em: i * 5000 }); // 10 m/s pro norte
  const atraso = 500 - (p.lat - LOJA.lat) * 110540;
  assert.ok(atraso < 15, `andando, ficou ${atraso} m atrás`);

  const h = criarFiltroGps();
  h({ ...LOJA, precisao: 10, em: 0 });
  const salto = h({ ...m(5000, 0), precisao: 10, em: 5000 });
  assert.ok(Math.abs(salto.lat - m(5000, 0).lat) < 1e-9, 'pulo grande recomeça o filtro');
});

test('rumo: norte 0°, leste 90°', () => {
  assert.ok(Math.abs(rumoDe(LOJA, m(100, 0)) - 0) < 0.5);
  assert.ok(Math.abs(rumoDe(LOJA, m(0, 100)) - 90) < 0.5);
  assert.ok(Math.abs(rumoDe(LOJA, m(-100, 0)) - 180) < 0.5);
});

test('buscarRota lê a resposta do OSRM e recusa resposta estranha', async () => {
  const resp = body => async () => ({ ok: true, json: async () => body });
  const boa = { code: 'Ok', routes: [{ distance: 2300, duration: 420, geometry: { coordinates: [[LOJA.lon, LOJA.lat], [-43.41, -20.37]] } }] };
  const r = await buscarRota(LOJA, { lat: -20.37, lon: -43.41 }, resp(boa));
  assert.deepEqual({ km: r.km, min: r.min, n: r.pontos.length }, { km: 2.3, min: 7, n: 2 });
  assert.equal(r.pontos[0].lat, LOJA.lat);
  assert.equal(await buscarRota(LOJA, { lat: -20.36, lon: -43.40 }, resp({ code: 'NoRoute' })), null);
  assert.equal(await buscarRota(LOJA, { lat: -20.35, lon: -43.40 }, resp({ code: 'Ok', routes: [{ distance: 'x', duration: 1, geometry: { coordinates: [] } }] })), null);
  assert.equal(await buscarRota(LOJA, { lat: -20.34, lon: -43.40 }, async () => { throw new Error('sem internet'); }), null);
  assert.equal(await buscarRota(LOJA, { lat: 999, lon: 0 }, resp(boa)), null, 'coordenada inválida nem sai do aparelho');
});
