// Rota pelas ruas, posição "grudada" na rota, recálculo e tempo de chegada: o mesmo
// modelo que o Uber e o iFood mostram pro entregador e pra loja. Tudo aqui é cálculo
// puro (testado em tests/rota.test.mjs), menos buscarRota, que pergunta a rota ao OSRM.

export const OSRM = 'https://router.project-osrm.org';
export const DESVIO_RECALCULA_M = 60;   // saiu da rota mais que isso...
export const LEITURAS_FORA = 2;         // ...em leituras seguidas: pede rota nova
export const INTERVALO_RECALCULO_MS = 15000;
export const GRUDA_M = 35;              // perto assim da rota, o ícone anda em cima da rua

const RAD = Math.PI / 180;

/** Rumo de a até b, em graus (0 = norte, 90 = leste). */
export function rumoDe(a, b) {
  const y = Math.sin((b.lon - a.lon) * RAD) * Math.cos(b.lat * RAD);
  const x = Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lon - a.lon) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

// Plano local em metros em volta de um ponto. Em poucos km o erro some.
function plano(o) {
  const kx = 111320 * Math.cos(o.lat * RAD), ky = 110540;
  return {
    para: p => ({ x: (p.lon - o.lon) * kx, y: (p.lat - o.lat) * ky }),
    de: q => ({ lat: o.lat + q.y / ky, lon: o.lon + q.x / kx })
  };
}

/**
 * Ponto da rota mais perto de `p` (map matching simplificado).
 * Devolve { ponto, desvioM, indice, feitoM, totalM, restanteKm, rumo } ou null sem rota.
 */
export function projetarNaRota(pontos, p) {
  if (!Array.isArray(pontos) || pontos.length < 2 || !p) return null;
  const pl = plano(p);
  let melhor = null, acum = 0;
  for (let i = 0; i < pontos.length - 1; i++) {
    const a = pl.para(pontos[i]), b = pl.para(pontos[i + 1]);
    const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy, L = Math.sqrt(L2);
    const t = L2 ? Math.max(0, Math.min(1, (-a.x * dx - a.y * dy) / L2)) : 0;
    const q = { x: a.x + t * dx, y: a.y + t * dy }, d = Math.hypot(q.x, q.y);
    if (!melhor || d < melhor.desvioM) melhor = { desvioM: d, indice: i, feitoM: acum + t * L, ponto: pl.de(q), rumo: rumoDe(pontos[i], pontos[i + 1]) };
    acum += L;
  }
  melhor.totalM = acum;
  melhor.restanteKm = Math.max(0, (acum - melhor.feitoM) / 1000);
  return melhor;
}

/** Minutos até o destino, na proporção do que falta da rota (o tempo do OSRM já considera o tipo de rua). */
export function etaRotaMin(rota, restanteKm) {
  if (!rota || !(rota.km > 0)) return null;
  return Math.max(1, Math.round(rota.min * Math.min(1, restanteKm / rota.km)));
}

/** Decide se pede rota nova: fora da rota em leituras seguidas, sem pedir de novo antes do intervalo. */
export function deveRecalcular({ desvioM, foraSeguidas, ultimoPedido, agora }) {
  return desvioM > DESVIO_RECALCULA_M && foraSeguidas >= LEITURAS_FORA && agora - ultimoPedido >= INTERVALO_RECALCULO_MS;
}

/**
 * Filtro de Kalman da posição (o que Uber e Google usam pra tirar a tremida do GPS).
 * Parado, a leitura que pula de um lado pro outro fica quieta; andando, o filtro
 * acompanha porque a incerteza cresce com a velocidade vista entre as leituras.
 */
export function criarFiltroGps() {
  let atual = null, varM = 0;
  return p => {
    const acc = Math.max(1, p.precisao || 1);
    if (!atual) { atual = { ...p }; varM = acc * acc; return { ...p }; }
    const dt = Math.max(0, (p.em - atual.em) / 1000);
    const salto = plano(atual).para(p), dist = Math.hypot(salto.x, salto.y);
    // Pulo enorme (saiu do túnel, voltou da pausa): recomeça do zero.
    if (dist > 1000) { atual = { ...p }; varM = acc * acc; return { ...p }; }
    const vel = Math.max(3, dt ? dist / dt : 0);
    varM += dt * vel * vel;
    const k = varM / (varM + acc * acc);
    atual = { ...p, lat: atual.lat + k * (p.lat - atual.lat), lon: atual.lon + k * (p.lon - atual.lon) };
    varM = (1 - k) * varM;
    return { ...atual, precisao: Math.round(Math.sqrt(varM)) };
  };
}

const geoOk = p => p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
const cache = new Map();

/**
 * Rota pelas ruas de a até b (servidor público do OSRM, mapa do OpenStreetMap).
 * Devolve { pontos, km, min } ou null (sem internet, servidor fora, resposta estranha):
 * aí o app volta pra estimativa em linha reta.
 */
export async function buscarRota(a, b, f = globalThis.fetch) {
  if (!geoOk(a) || !geoOk(b)) return null;
  const chave = [a.lat, a.lon, b.lat, b.lon].map(n => n.toFixed(4)).join(',');
  if (cache.has(chave)) return cache.get(chave);
  const url = `${OSRM}/route/v1/driving/${a.lon.toFixed(6)},${a.lat.toFixed(6)};${b.lon.toFixed(6)},${b.lat.toFixed(6)}?overview=full&geometries=geojson&alternatives=false&steps=false`;
  try {
    const r = await f(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = await r.json();
    const rt = j?.code === 'Ok' && j.routes?.[0];
    const coords = rt?.geometry?.coordinates;
    if (!Array.isArray(coords) || !Number.isFinite(rt.distance) || !Number.isFinite(rt.duration)) return null;
    const pontos = coords.slice(0, 5000).map(c => ({ lat: +c?.[1], lon: +c?.[0] })).filter(geoOk);
    if (pontos.length < 2) return null;
    const rota = { pontos, km: rt.distance / 1000, min: rt.duration / 60 };
    if (cache.size > 40) cache.delete(cache.keys().next().value);
    cache.set(chave, rota);
    return rota;
  } catch { return null; }
}
