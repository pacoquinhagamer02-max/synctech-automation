// Regras de negócio do Marca aí. Funções puras, sem DOM nem armazenamento:
// dá pra testar com `node --test` e reaproveitar no servidor quando ele existir.

export const TABELA = Object.freeze({
  base: 8, kmInclusos: 3, porKm: 2, chuva: 2,
  esperaGratisMin: 10, esperaPorMin: 0.5,
  taxaPlataforma: 1.99, deslocamentoCancelado: 5, voltaPct: 0.5, paradaExtra: 3,
  tempoOferta: 30, maisTempoOferta: 30
});

/** Até quantas entregas cabem numa corrida só (Lalamove e Borzo fazem rota com várias paradas). */
export const MAX_PARADAS = 5;

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

/**
 * Frete do motoboy. `volta` = ele precisa voltar à loja depois de entregar (maquininha, troco,
 * devolução): paga metade do trajeto de novo, como o "retorno" dos apps de entrega.
 * A chuva não entra na conta da volta. `paradas` = quantas entregas a corrida tem: cada parada
 * além da primeira paga R$ 3 (o km da rota inteira já entra no `km`).
 */
export function frete(km, chuva, volta = false, paradas = 1) {
  const extra = Math.max(0, (+km || 0) - TABELA.kmInclusos);
  const ida = TABELA.base + extra * TABELA.porKm;
  const n = Math.min(MAX_PARADAS, Math.max(1, Math.round(+paradas) || 1));
  return r2(ida * (volta ? 1 + TABELA.voltaPct : 1) + (chuva ? TABELA.chuva : 0) + (n - 1) * TABELA.paradaExtra);
}

/* ============ Cobrança na entrega (pedido de WhatsApp/telefone) ============
   Como no "Sob Demanda" do iFood e na cobrança na entrega da Borzo/Lalamove: a loja diz se o
   cliente já pagou ou se o motoboy cobra na porta, em dinheiro (com troco) ou na maquininha. */
export const COBRANCAS = Object.freeze(['pago', 'dinheiro', 'maquininha']);

/** Troco que o motoboy precisa levar (dinheiro): "troco pra R$ 50" num pedido de R$ 37 → R$ 13. */
export function trocoLevar(c) {
  if (c.cobranca !== 'dinheiro' || !(c.troco > 0) || !(c.cobrar > 0)) return 0;
  return r2(Math.max(0, c.troco - c.cobrar));
}

/** Linha curta que o motoboy lê antes de aceitar (sem valor do pedido: isso só depois do aceite). */
export function avisoCobranca(c) {
  if (c.cobranca === 'maquininha') return 'Levar maquininha: o cliente paga na entrega';
  if (c.cobranca === 'dinheiro') return 'Cobrar em dinheiro na entrega';
  return '';
}

/* ============ Tempo e ganho por hora na oferta (como Uber e 99 mostram) ============ */
export const MIN_BALCAO = 5; // minutos médios entre chegar na loja e sair com o pedido
/**
 * Minutos estimados da corrida inteira e quanto ela rende por hora.
 * @param {{ km: number, valor: number, volta?: boolean }} c
 * @param {number|null} kmAteLoja distância do motoboy até a loja (null se sem GPS)
 */
export function estimativaCorrida(c, kmAteLoja) {
  const min = (kmAteLoja != null ? etaMin(kmAteLoja) : 0) + MIN_BALCAO + etaMin(c.km) + (c.volta ? etaMin(c.km) : 0);
  return { min, porHora: r2(c.valor / (min / 60)) };
}

/* ============ Link de rastreio pro cliente (como iFood Sob Demanda e Lalamove) ============ */
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export const TOKEN_RASTREIO = /^[A-Za-z0-9_-]{22}$/;
/** Segredo de 22 caracteres (132 bits): quem não recebeu o link não consegue adivinhar. */
export function tokenRastreio(rng = globalThis.crypto) {
  const b = new Uint8Array(22);
  rng.getRandomValues(b);
  return [...b].map(x => ALFABETO[x & 63]).join('');
}
/** O segredo vai depois do # : não sai em log de servidor nem em referrer. */
export function linkRastreio(base, token) {
  return TOKEN_RASTREIO.test(token || '') ? `${String(base).replace(/[#?].*$/, '').replace(/[^/]*$/, '')}rastreio.html#${token}` : '';
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

export function saldo(calls, saques, turnos = []) {
  const total = calls.filter(c => c.motoboy).reduce((a, c) => a + ganho(c), 0) + turnos.filter(t => t.motoboy).reduce((a, t) => a + ganhoTurno(t), 0);
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
export function mensagemCliente(c, link = '') {
  const quem = c.motoboy ? `com o motoboy ${c.motoboy}${c.placa ? ` (placa ${c.placa})` : ''}` : 'aguardando o motoboy';
  const pagar = c.cobranca === 'dinheiro' && c.cobrar > 0 ? ` O motoboy vai cobrar ${brlTexto(c.cobrar)} em dinheiro${c.troco > c.cobrar ? ` e leva troco pra ${brlTexto(c.troco)}` : ''}.`
    : c.cobranca === 'maquininha' && c.cobrar > 0 ? ` O motoboy leva a maquininha pra cobrar ${brlTexto(c.cobrar)}.` : '';
  return `Oi${c.cliente ? `, ${c.cliente}` : ''}! Seu pedido da ${c.empresa} está ${quem}.${pagar} Na entrega, informe o código ${c.codigo}.${link ? ` Acompanhe no mapa: ${link}` : ''}`;
}
const brlTexto = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
/** "Cheguei" apertado a mais que isso da loja (com GPS ligado) pede confirmação. */
export const RAIO_CONFERE_CHEGADA_M = 400;
/** Abaixo disso do ponto do cliente, o motoboy está "chegando". */
export const RAIO_CLIENTE_M = 300;

/* ============ Raio de atuação e despacho em ondas ============
   Como Uber Flash, 99Entrega e iFood: o chamado toca primeiro pra quem está perto da loja
   e o raio cresce se ninguém aceitar. O motoboy escolhe até onde topa ir buscar. */
export const RAIOS_MOTOBOY = Object.freeze([2, 5, 10, 20]);
export const RAIOS_BUSCA = Object.freeze([3, 5, 8, 15]);
export const ONDAS_KM = Object.freeze([2, 4, 8, 15]);
export const ONDA_MS = 30000;
export const RAIO_MOTOBOY_PADRAO = 5;
export const RAIO_BUSCA_PADRAO = 5;

/** true se as duas posições estão a até `metros` uma da outra. */
export const perto = (a, b, metros) => !!(a && b) && distanciaKm(a, b) * 1000 <= metros;

/**
 * Raio atual de um chamado aberto: começa em 2 km e cresce a cada 30 s até o raio que a loja escolheu.
 * Enquanto vale a janela dos favoritos, as ondas ainda não começaram.
 * @param {{criadoEm: number, prioridadeAte?: number|null, raioKm?: number}} c
 * @param {number} [agora]
 */
export function raioOnda(c, agora = Date.now()) {
  const max = RAIOS_BUSCA.includes(c.raioKm) ? c.raioKm : RAIO_BUSCA_PADRAO;
  const inicio = Math.max(c.criadoEm || 0, c.prioridadeAte || 0);
  const i = Math.max(0, Math.floor((agora - inicio) / ONDA_MS));
  return Math.min(max, ONDAS_KM[Math.min(i, ONDAS_KM.length - 1)]);
}

/**
 * Esse chamado chega pra esse motoboy? Distância pelas ruas até a loja, comparada com o
 * raio dele e com a onda atual do chamado. Sem GPS do motoboy ou sem localização da loja,
 * não dá pra filtrar: o chamado aparece (e `km` vem null).
 * @returns {{ ok: boolean, km: number|null }}
 */
export function alcance(c, pos, raioMotoboy = RAIO_MOTOBOY_PADRAO, agora = Date.now()) {
  if (!pos || !c.lojaGeo) return { ok: true, km: null };
  const d = kmEstimado(pos, c.lojaGeo);
  return { ok: d <= raioMotoboy && d <= raioOnda(c, agora), km: d };
}

/**
 * Posição aproximada (grade de ~1 km) pra contar motoboys disponíveis sem revelar onde cada um está.
 * Vai como inteiro (centésimos de grau), então o servidor consegue exigir a aproximação.
 */
export const gradeAproximada = p => ({ latC: Math.round(p.lat * 100), lonC: Math.round(p.lon * 100) });
export const deGrade = g => ({ lat: g.latC / 100, lon: g.lonC / 100 });

/** Quantos motoboys disponíveis estão a até `raio` km (linha reta, com folga de ~1 km da grade). */
export function disponiveisNoRaio(lista, loja, raio) {
  if (!loja) return null;
  return lista.filter(g => distanciaKm(loja, deGrade(g)) <= raio + 0.8).length;
}

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

/* ============ Várias paradas numa corrida (como Lalamove e Borzo) ============
   A loja junta até 5 entregas numa saída só. Cada cliente tem o seu código e o seu link;
   o motoboy entrega na ordem da rota e a corrida só termina na última parada. */

/** Quantas entregas a corrida tem. */
export const nParadas = c => Math.max(1, c.paradas?.length || c.nParadas || 1);
/** Em que parada o motoboy está (0 = primeira). */
export const paradaAtual = c => Math.min(Math.max(0, c.entregues || 0), nParadas(c) - 1);

/**
 * Ordem da rota: sempre a parada mais perto de onde o motoboy vai estar (vizinho mais próximo).
 * Paradas sem ponto no mapa ficam no fim, na ordem em que a loja digitou.
 * @param {{lat:number, lon:number}|null} loja
 * @param {Array<{clienteGeo?: {lat:number, lon:number}|null}>} paradas
 */
export function ordenarParadas(loja, paradas) {
  const comGeo = paradas.filter(p => p.clienteGeo), semGeo = paradas.filter(p => !p.clienteGeo);
  if (!loja || comGeo.length < 2) return [...comGeo, ...semGeo];
  const resto = [...comGeo], rota = [];
  let aqui = loja;
  while (resto.length) {
    let i = 0;
    resto.forEach((p, j) => { if (distanciaKm(aqui, p.clienteGeo) < distanciaKm(aqui, resto[i].clienteGeo)) i = j; });
    const [p] = resto.splice(i, 1);
    rota.push(p); aqui = p.clienteGeo;
  }
  return [...rota, ...semGeo];
}

/** Km pelas ruas da loja passando por todas as paradas, na ordem. null se faltar ponto no mapa. */
export function kmRota(loja, paradas) {
  if (!loja || !paradas.length || paradas.some(p => !p.clienteGeo)) return null;
  let total = 0, aqui = loja;
  paradas.forEach(p => { total += distanciaKm(aqui, p.clienteGeo) * FATOR_RUA; aqui = p.clienteGeo; });
  return Math.max(0.5, Math.round(total * 10) / 10);
}

/* ============ Motoboy por turno (reserva por hora no horário de pico) ============
   A loja reserva um motoboy por algumas horas pagando um valor por hora garantido. Durante o
   turno, os chamados da loja tocam primeiro pra ele, e cada entrega continua pagando o frete. */
export const TURNO = Object.freeze({ valorHoraMin: 12, valorHoraMax: 60, horasMin: 2, horasMax: 12, antecedenciaDias: 14 });
export const STATUS_TURNO = Object.freeze(['aberto', 'aceito', 'concluido', 'cancelado']);
export const horasTurno = t => r2((t.fim - t.inicio) / 3600000);
/** Valor garantido do turno inteiro. */
export const valorTurno = t => r2(horasTurno(t) * t.valorHora);

/** Turno válido? Devolve o problema em texto, ou '' se estiver certo. */
export function conferirTurno(t, agora = Date.now()) {
  const h = horasTurno(t);
  if (!(t.valorHora >= TURNO.valorHoraMin && t.valorHora <= TURNO.valorHoraMax)) return `O valor por hora fica entre R$ ${TURNO.valorHoraMin} e R$ ${TURNO.valorHoraMax}.`;
  if (!(h >= TURNO.horasMin && h <= TURNO.horasMax)) return `O turno precisa ter de ${TURNO.horasMin} a ${TURNO.horasMax} horas.`;
  if (t.inicio < agora - 5 * 60000) return 'O turno precisa começar daqui pra frente.';
  if (t.inicio > agora + TURNO.antecedenciaDias * 86400000) return `Dá pra reservar com até ${TURNO.antecedenciaDias} dias de antecedência.`;
  return '';
}

/** O que o motoboy recebe pelo turno: o valor inteiro quando termina; 1 hora se a loja desmarcar depois do aceite. */
export function ganhoTurno(t) {
  if (t.status === 'concluido') return valorTurno(t);
  if (t.status === 'cancelado' && t.compensacao) return t.compensacao;
  return 0;
}

/** Turno aceito valendo agora pra essa empresa (o motoboy dele recebe os chamados primeiro). */
export function turnoAgora(turnos, empresa, agora = Date.now()) {
  return turnos.find(t => t.empresa === empresa && t.status === 'aceito' && t.inicio <= agora && t.fim > agora) || null;
}

/* ============ Relatório da loja ============ */
const media = l => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);

/**
 * Números de um período pra loja: entregas, gastos, tempos e quem mais entregou.
 * @param {Array} calls
 * @param {string} empresa
 * @param {number} de início do período (ms)
 * @param {number} ate fim do período (ms, exclusivo)
 * @param {Array} [turnos]
 */
export function relatorioEmpresa(calls, empresa, de, ate, turnos = []) {
  const doPeriodo = calls.filter(c => c.empresa === empresa && !c.teste && c.criadoEm >= de && c.criadoEm < ate);
  const entregues = doPeriodo.filter(c => c.status === 'entregue');
  const cancelados = doPeriodo.filter(c => c.status === 'cancelado');
  const soma = (l, f) => r2(l.reduce((a, c) => a + (f(c) || 0), 0));
  const frete = soma(entregues, c => c.valor), espera = soma(entregues, c => c.espera), gorjeta = soma(entregues, c => c.gorjeta);
  const taxa = soma(entregues, c => c.taxa ?? TABELA.taxaPlataforma), cancelamento = soma(cancelados, c => c.compensacao);
  const turno = soma(turnos.filter(t => t.empresa === empresa && t.inicio >= de && t.inicio < ate), ganhoTurno);
  const gasto = r2(frete + espera + gorjeta + taxa + cancelamento + turno);
  const paradas = entregues.reduce((a, c) => a + nParadas(c), 0);
  const min = (a, b) => (a != null && b != null && b >= a ? (b - a) / 60000 : null);
  const tempo = f => { const m = media(entregues.map(f).filter(v => v != null)); return m == null ? null : Math.round(m); };
  const porMotoboy = {};
  entregues.forEach(c => {
    const k = c.motoboy || 'Sem nome';
    porMotoboy[k] = porMotoboy[k] || { nome: k, n: 0, valor: 0 };
    porMotoboy[k].n += nParadas(c); porMotoboy[k].valor = r2(porMotoboy[k].valor + ganho(c));
  });
  const porDia = {};
  entregues.forEach(c => { const k = new Date(c.criadoEm).toLocaleDateString('sv'); porDia[k] = (porDia[k] || 0) + nParadas(c); });
  const porHora = Array(24).fill(0);
  entregues.forEach(c => { porHora[new Date(c.criadoEm).getHours()] += nParadas(c); });
  return {
    chamados: doPeriodo.length, entregues: entregues.length, paradas, cancelados: cancelados.length,
    semMotoboy: cancelados.filter(c => !c.motoboy).length,
    gasto, frete, espera, gorjeta, taxa, cancelamento, turno,
    custoPorEntrega: paradas ? r2(gasto / paradas) : null,
    km: r2(entregues.reduce((a, c) => a + kmCorrida(c), 0)),
    minAceite: tempo(c => min(c.criadoEm, c.aceitoEm)),
    minBalcao: tempo(c => min(c.chegouEm, c.coletouEm)),
    minEntrega: tempo(c => min(c.coletouEm, c.entregueEm)),
    minTotal: tempo(c => min(c.criadoEm, c.entregueEm)),
    motoboys: Object.values(porMotoboy).sort((a, b) => b.n - a.n),
    porDia, porHora,
    pico: porHora.some(Boolean) ? porHora.indexOf(Math.max(...porHora)) : null
  };
}

/** Planilha (CSV com ; pro Excel em português) das corridas do período. Célula que começa com = + - @ vira texto. */
export function csvEmpresa(calls, empresa, de, ate) {
  const cel = v => '"' + String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@])/, "'$1") + '"';
  const num = v => (+v || 0).toFixed(2).replace('.', ',');
  const quando = t => (t ? new Date(t).toLocaleString('pt-BR') : '');
  const linhas = calls.filter(c => c.empresa === empresa && !c.teste && c.criadoEm >= de && c.criadoEm < ate)
    .sort((a, b) => a.criadoEm - b.criadoEm)
    .map(c => [quando(c.criadoEm), c.status, nParadas(c), (c.paradas?.length ? c.paradas.map(p => p.entrega) : [c.entrega]).join(' | '), c.motoboy, num(kmCorrida(c)),
      num(c.valor), num(c.espera), num(c.gorjeta), num(c.status === 'entregue' ? (c.taxa ?? TABELA.taxaPlataforma) : 0), num(c.compensacao), quando(c.aceitoEm), quando(c.entregueEm)].map(cel).join(';'));
  return ['Criado em;Situação;Paradas;Entregas;Motoboy;Km;Frete;Espera;Gorjeta;Taxa do app;Cancelamento;Aceito em;Entregue em', ...linhas].join('\r\n');
}
