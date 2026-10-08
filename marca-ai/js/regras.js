// Regras de negócio do Marca aí. Funções puras, sem DOM nem armazenamento:
// dá pra testar com `node --test` e reaproveitar no servidor quando ele existir.

export const TABELA = Object.freeze({
  base: 8, kmInclusos: 3, porKm: 2, chuva: 2,
  esperaGratisMin: 10, esperaPorMin: 0.5,
  taxaPlataforma: 1.99, deslocamentoCancelado: 5,
  tempoOferta: 30, maisTempoOferta: 30
});

export const LIMITES = Object.freeze({
  kmMin: 0.1, kmMax: 100, nome: 60, endereco: 160, obs: 300, tel: 20, pix: 100, placa: 10,
  gorjetas: [2, 5, 10], tentativasCodigo: 5, bloqueioCodigoMs: 2 * 60000, maxChamados: 500
});

export const STATUS = Object.freeze(['aberto', 'aceito', 'coleta', 'coletado', 'entregue', 'cancelado']);
export const ATIVOS = Object.freeze(['aceito', 'coleta', 'coletado']);

// Máquina de estados: qualquer mudança de status passa por aqui.
const TRANSICOES = Object.freeze({
  aberto: ['aceito', 'cancelado'],
  aceito: ['coleta', 'cancelado'],
  coleta: ['coletado', 'cancelado'],
  coletado: ['entregue'],
  entregue: [],
  cancelado: []
});
export const podeIr = (de, para) => Object.hasOwn(TRANSICOES, de) && TRANSICOES[de].includes(para);

export const TAGS_BOAS = Object.freeze(['Pedido estava pronto', 'Atendimento bom', 'Tem onde parar a moto']);
export const TAGS_RUINS = Object.freeze(['Demorou pra liberar', 'Endereço confuso', 'Me trataram mal']);

export const r2 = v => Math.round(v * 100) / 100;

export function frete(km, chuva) {
  const extra = Math.max(0, (+km || 0) - TABELA.kmInclusos);
  return r2(TABELA.base + extra * TABELA.porKm + (chuva ? TABELA.chuva : 0));
}

export function taxaEspera(c, agora = Date.now()) {
  if (c.chegouEm == null) return 0;
  const min = Math.floor(((c.coletouEm ?? agora) - c.chegouEm) / 60000);
  return r2(Math.max(0, min - TABELA.esperaGratisMin) * TABELA.esperaPorMin);
}

export function ganho(c) {
  if (c.status === 'entregue') return r2(c.valor + (c.espera || 0) + (c.gorjeta || 0));
  if (c.status === 'cancelado' && c.compensacao) return c.compensacao;
  return 0;
}

export const quandoGanhou = c => c.entregueEm || c.canceladoEm || c.criadoEm;

/** Km da corrida: o medido pelo GPS quando existe, senão o informado pela empresa. */
export const kmCorrida = c => (c.kmReal > 0 ? c.kmReal : c.km);
export const mesmoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

export const custoKm = p => (+p.consumo > 0 ? (+p.gasolina || 0) / +p.consumo : 0);

export function resumoDia(calls, profile, dia = Date.now()) {
  const doDia = calls.filter(c => c.motoboy && ganho(c) > 0 && mesmoDia(quandoGanhou(c), dia));
  const entregues = doDia.filter(c => c.status === 'entregue');
  const bruto = r2(doDia.reduce((a, c) => a + ganho(c), 0));
  const km = r2(entregues.reduce((a, c) => a + kmCorrida(c), 0));
  return { n: entregues.length, bruto, km, comb: r2(km * custoKm(profile)) };
}

export function saldo(calls, saques) {
  const total = calls.filter(c => c.motoboy).reduce((a, c) => a + ganho(c), 0);
  return r2(total - saques.reduce((a, s) => a + s.valor, 0));
}

export function reputacao(calls, empresa) {
  const cs = calls.filter(c => c.empresa === empresa && c.avaliado && c.nota);
  if (!cs.length) return null;
  const esperas = cs.filter(c => c.chegouEm != null && c.coletouEm != null).map(c => (c.coletouEm - c.chegouEm) / 60000);
  const tags = {};
  cs.forEach(c => c.tags.forEach(t => { tags[t] = (tags[t] || 0) + 1; }));
  return {
    nota: cs.reduce((a, c) => a + c.nota, 0) / cs.length,
    espera: esperas.length ? esperas.reduce((a, b) => a + b, 0) / esperas.length : null,
    n: cs.length, tags
  };
}

// Código de entrega com gerador criptográfico (Math.random é previsível).
export function novoCodigo(rng = globalThis.crypto) {
  const b = new Uint32Array(1);
  rng.getRandomValues(b);
  return String(1000 + (b[0] % 9000));
}

export function novoId(rng = globalThis.crypto) {
  return typeof rng.randomUUID === 'function' ? rng.randomUUID() : Date.now().toString(36) + novoCodigo(rng);
}

/**
 * Valor médio das entregas feitas, pra estimar quantas corridas faltam pra meta.
 * Sem histórico, usa o frete mínimo.
 * @param {Array} calls
 * @returns {number}
 */
export function ticketMedio(calls) {
  const es = calls.filter(c => c.motoboy && c.status === 'entregue');
  return es.length ? es.reduce((a, c) => a + ganho(c), 0) / es.length : frete(TABELA.kmInclusos);
}

/**
 * Texto pronto pro cliente final: quem leva, a placa e o código de entrega.
 * @param {{cliente?: string, empresa: string, motoboy?: string, placa?: string, codigo: string}} c
 * @returns {string}
 */
export function mensagemCliente(c) {
  const quem = c.motoboy ? `com o motoboy ${c.motoboy}${c.placa ? ` (placa ${c.placa})` : ''}` : 'aguardando o motoboy';
  return `Oi${c.cliente ? `, ${c.cliente}` : ''}! Seu pedido da ${c.empresa} está ${quem}. Na entrega, informe o código ${c.codigo}.`;
}

/**
 * Números do mês de uma empresa: entregas, gasto total (frete, espera, gorjeta,
 * taxa do app e deslocamentos de cancelamento) e espera média no balcão.
 * @param {Array} calls
 * @param {string} empresa
 * @param {Date} [quando]
 * @returns {{total: number, entregas: number, gasto: number, esperaMin: number | null}}
 */
export function resumoMes(calls, empresa, quando = new Date()) {
  const doMes = calls.filter(c => {
    const d = new Date(c.criadoEm);
    return c.empresa === empresa && !c.teste && d.getMonth() === quando.getMonth() && d.getFullYear() === quando.getFullYear();
  });
  const entregues = doMes.filter(c => c.status === 'entregue');
  const gasto = entregues.reduce((a, c) => a + ganho(c) + (c.taxa ?? TABELA.taxaPlataforma), 0) + doMes.reduce((a, c) => a + (c.compensacao || 0), 0);
  const esperas = entregues.filter(c => c.chegouEm != null && c.coletouEm != null).map(c => (c.coletouEm - c.chegouEm) / 60000);
  return {
    total: doMes.length,
    entregas: entregues.length,
    gasto: r2(gasto),
    esperaMin: esperas.length ? Math.round(esperas.reduce((a, b) => a + b, 0) / esperas.length) : null
  };
}

const doMesmoMes = (t, quando) => { const d = new Date(t); return d.getMonth() === quando.getMonth() && d.getFullYear() === quando.getFullYear(); };

/**
 * Informe de ganhos do mês do motoboy (pra guardar ou declarar como MEI):
 * cada corrida paga, totais, km, gasolina estimada e saques.
 * @param {Array} calls
 * @param {Array} saques
 * @param {{consumo: number, gasolina: number}} profile
 * @param {Date} [quando]
 */
export function informeMes(calls, saques, profile, quando = new Date()) {
  const linhas = calls
    .filter(c => c.motoboy && ganho(c) > 0 && doMesmoMes(quandoGanhou(c), quando))
    .sort((a, b) => quandoGanhou(a) - quandoGanhou(b))
    .map(c => ({ em: quandoGanhou(c), empresa: c.empresa, km: c.status === 'entregue' ? kmCorrida(c) : 0, valor: ganho(c), cancelada: c.status === 'cancelado' }));
  const km = r2(linhas.reduce((a, l) => a + l.km, 0));
  const sacado = r2(saques.filter(s => doMesmoMes(s.em, quando)).reduce((a, s) => a + s.valor, 0));
  return {
    linhas,
    corridas: linhas.filter(l => !l.cancelada).length,
    bruto: r2(linhas.reduce((a, l) => a + l.valor, 0)),
    km,
    comb: r2(km * custoKm(profile)),
    sacado
  };
}

export const FAIXAS = Object.freeze([
  { nome: 'Manhã', de: 6, ate: 11 }, { nome: 'Almoço', de: 11, ate: 14 },
  { nome: 'Tarde', de: 14, ate: 18 }, { nome: 'Noite', de: 18, ate: 23 }, { nome: 'Madrugada', de: 23, ate: 6 }
]);

/**
 * Em que faixa do dia o motoboy mais ganha, pelo horário das entregas feitas.
 * @param {Array} calls
 * @returns {Array<{nome: string, de: number, ate: number, n: number, total: number}>} da que mais rende pra menos
 */
export function faixasHorario(calls) {
  const dentro = (h, f) => (f.de < f.ate ? h >= f.de && h < f.ate : h >= f.de || h < f.ate);
  const soma = FAIXAS.map(f => ({ ...f, n: 0, total: 0 }));
  calls.filter(c => c.motoboy && c.status === 'entregue' && c.entregueEm).forEach(c => {
    const f = soma.find(x => dentro(new Date(c.entregueEm).getHours(), x));
    f.n += 1; f.total = r2(f.total + ganho(c));
  });
  return soma.filter(f => f.n).sort((a, b) => b.total - a.total);
}

/* ============ GPS e distância ============ */

/**
 * Distância em linha reta entre dois pontos (fórmula de Haversine), em km.
 * @param {{lat: number, lon: number}} a
 * @param {{lat: number, lon: number}} b
 */
export function distanciaKm(a, b) {
  const R = 6371, rad = g => g * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Rua não é linha reta: em cidade com ladeira e curva (Mariana), o caminho real fica ~35% maior.
export const FATOR_RUA = 1.35;

/** Km estimado pelas ruas entre loja e cliente, a partir das coordenadas. */
export function kmEstimado(a, b) {
  return Math.max(0.5, Math.round(distanciaKm(a, b) * FATOR_RUA * 10) / 10);
}

/** Minutos estimados de moto na cidade (média de 22 km/h com trânsito e ladeira). */
export function etaMin(km, kmh = 22) {
  return Math.max(1, Math.round(km / kmh * 60));
}

/** Raio (em metros) em que o motoboy é considerado "na loja" pelo GPS. */
export const RAIO_CHEGADA_M = 120;

/**
 * Lê coordenadas de um link de localização (WhatsApp, Google Maps, Waze, OpenStreetMap)
 * ou de um texto "lat, lon". Devolve null se não achar coordenada válida.
 * @param {string} texto
 * @returns {{lat: number, lon: number} | null}
 */
export function extrairGeo(texto) {
  const t = String(texto || '');
  const padroes = [
    /[?&](?:q|query|ll|daddr|destination|center)=(-?\d{1,2}\.\d+)\s*(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i,
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /[?&]mlat=(-?\d{1,2}\.\d+)&mlon=(-?\d{1,3}\.\d+)/i,
    /(?:^|\s)(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})(?:\s|$)/
  ];
  for (const p of padroes) {
    const m = t.match(p);
    if (m) {
      const lat = +m[1], lon = +m[2];
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
    }
  }
  return null;
}

/* ============ Planos da empresa ============
   Quem paga o app é a empresa. O motoboy nunca paga nada e fica com 100% do frete. */
export const PLANOS = Object.freeze({
  avulso: { nome: 'Avulso', mensal: 0, incluidos: 0, taxa: 1.99, extra: 1.99, favoritos: false, resumo: 'Sem mensalidade. Paga só quando chama.' },
  loja: { nome: 'Loja', mensal: 89, incluidos: 150, taxa: 0, extra: 0.79, favoritos: true, resumo: '150 chamados no mês e motoboys favoritos. Depois de 150, R$ 0,79 cada.' },
  pro: { nome: 'Pro', mensal: 179, incluidos: Infinity, taxa: 0, extra: 0, favoritos: true, resumo: 'Tudo do Loja, sem limite de chamados, com relatório do mês e suporte direto no WhatsApp.' }
});

/**
 * Taxa do app pro próximo chamado, conforme o plano e quantos chamados a empresa já fez no mês.
 * @param {keyof PLANOS} plano
 * @param {number} feitosNoMes
 */
export function taxaChamado(plano, feitosNoMes) {
  const p = PLANOS[plano] || PLANOS.avulso;
  return feitosNoMes < p.incluidos ? p.taxa : p.extra;
}

/**
 * Quanto a empresa pagaria ao app num mês com N chamados, em cada plano. Serve pra mostrar qual compensa.
 * @param {number} n chamados no mês
 */
export function custoPlanos(n) {
  return Object.fromEntries(Object.entries(PLANOS).map(([k, p]) =>
    [k, r2(p.mensal + Math.max(0, n - p.incluidos) * p.extra + Math.min(n, p.incluidos === Infinity ? n : p.incluidos) * p.taxa)]));
}
