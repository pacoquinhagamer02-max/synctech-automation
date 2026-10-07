// Validação de tudo que entra no app (armazenamento, outras abas, formulários).
// Nada é confiado: tipos conferidos, textos cortados, números limitados e o valor
// da corrida sempre recalculado pela tabela, nunca lido do dado salvo.
import { LIMITES, STATUS, TABELA, TAGS_BOAS, TAGS_RUINS, frete } from './regras.js';

const TAGS = new Set([...TAGS_BOAS, ...TAGS_RUINS]);

export const texto = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
export const numero = (v, min, max, padrao) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
};
const instante = v => (Number.isFinite(v) && v > 0 ? v : null);

export const PERFIL_PADRAO = Object.freeze({
  nome: '', moto: '', placa: '', pix: '', contato: '',
  consumo: 35, gasolina: 6.29, meta: 150, oleoCada: 1000, oleoDesde: 0
});
export const EMPRESA_PADRAO = Object.freeze({ nome: '', endereco: '', tel: '' });

export function limparPerfil(p = {}) {
  const d = PERFIL_PADRAO;
  return {
    nome: texto(p.nome, LIMITES.nome),
    moto: texto(p.moto, 40),
    placa: texto(p.placa, 40).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, LIMITES.placa),
    pix: texto(p.pix, LIMITES.pix),
    contato: texto(p.contato, LIMITES.tel).replace(/[^\d()+ -]/g, ''),
    consumo: numero(p.consumo, 5, 120, d.consumo),
    gasolina: numero(p.gasolina, 0.5, 30, d.gasolina),
    meta: numero(p.meta, 0, 5000, d.meta),
    oleoCada: numero(p.oleoCada, 100, 20000, d.oleoCada),
    oleoDesde: instante(p.oleoDesde) || 0
  };
}

export function limparEmpresa(e = {}) {
  return {
    nome: texto(e.nome, LIMITES.nome),
    endereco: texto(e.endereco, LIMITES.endereco),
    tel: texto(e.tel, LIMITES.tel).replace(/[^\d()+ -]/g, '')
  };
}

export function limparChamado(c) {
  if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !STATUS.includes(c.status)) return null;
  const km = numero(c.km, LIMITES.kmMin, LIMITES.kmMax, 1);
  const chuva = c.chuva === true;
  return {
    id: texto(c.id, 64),
    empresa: texto(c.empresa, LIMITES.nome),
    coleta: texto(c.coleta, LIMITES.endereco),
    entrega: texto(c.entrega, LIMITES.endereco),
    cliente: texto(c.cliente, LIMITES.nome),
    telCliente: texto(c.telCliente, LIMITES.tel).replace(/[^\d()+ -]/g, ''),
    tel: texto(c.tel, LIMITES.tel).replace(/[^\d()+ -]/g, ''),
    obs: texto(c.obs, LIMITES.obs),
    km, chuva,
    valor: frete(km, chuva),
    teste: c.teste === true,
    codigo: /^\d{4}$/.test(c.codigo) ? c.codigo : '0000',
    status: c.status,
    criadoEm: instante(c.criadoEm) || Date.now(),
    aceitoEm: instante(c.aceitoEm), chegouEm: instante(c.chegouEm), coletouEm: instante(c.coletouEm),
    entregueEm: instante(c.entregueEm), canceladoEm: instante(c.canceladoEm),
    motoboy: texto(c.motoboy, LIMITES.nome), moto: texto(c.moto, 40), placa: texto(c.placa, LIMITES.placa),
    espera: numero(c.espera, 0, 500, 0),
    gorjeta: LIMITES.gorjetas.includes(c.gorjeta) ? c.gorjeta : 0,
    compensacao: c.compensacao === TABELA.deslocamentoCancelado ? TABELA.deslocamentoCancelado : 0,
    avaliado: c.avaliado === true,
    nota: Math.round(numero(c.nota, 0, 5, 0)),
    tags: Array.isArray(c.tags) ? [...new Set(c.tags.filter(t => TAGS.has(t)))] : [],
    tentativas: Math.round(numero(c.tentativas, 0, 99, 0)),
    bloqueadoAte: instante(c.bloqueadoAte)
  };
}

export function limparEstado(d) {
  const o = d && typeof d === 'object' ? d : {};
  const lista = v => (Array.isArray(v) ? v : []);
  return {
    calls: lista(o.calls).map(limparChamado).filter(Boolean),
    recusados: lista(o.recusados).filter(x => typeof x === 'string').slice(-200),
    saques: lista(o.saques)
      .filter(s => s && Number.isFinite(s.valor) && s.valor > 0 && Number.isFinite(s.em))
      .map(s => ({ valor: s.valor, em: s.em, pix: texto(s.pix, LIMITES.pix) })),
    profile: limparPerfil(o.profile),
    empresa: limparEmpresa(o.empresa),
    online: o.online === true,
    onlineDesde: instante(o.onlineDesde),
    pausaAte: instante(o.pausaAte)
  };
}
