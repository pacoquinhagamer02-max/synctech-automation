// Único ponto do app que lê e grava dados.
// Hoje: localStorage + BroadcastChannel (abas do mesmo aparelho).
// Quando tiver servidor, só este arquivo muda; as telas continuam iguais.
import { limparEstado } from './esquema.js';
import { ATIVOS, LIMITES } from './regras.js';

const BASE = 'marcaai:v1';
let CHAVE = BASE;
let canal = 'BroadcastChannel' in globalThis ? new BroadcastChannel(CHAVE) : null;
const ouvintes = new Set();

function ler() {
  try { return limparEstado(JSON.parse(localStorage.getItem(CHAVE))); } catch { return limparEstado(null); }
}

let estado = ler();
export const S = () => estado;

function avisar() { ouvintes.forEach(fn => fn(estado)); }
export function aoMudar(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }

// Mantém o histórico dentro do limite sem nunca apagar corrida em andamento.
function podar(calls) {
  if (calls.length <= LIMITES.maxChamados) return calls;
  const ativos = calls.filter(c => c.status === 'aberto' || ATIVOS.includes(c.status));
  const resto = calls.filter(c => !ativos.includes(c)).sort((a, b) => b.criadoEm - a.criadoEm);
  return [...ativos, ...resto.slice(0, LIMITES.maxChamados - ativos.length)];
}

// Toda escrita passa por aqui: relê o estado mais novo (outra aba pode ter mudado),
// aplica a alteração e valida de novo antes de gravar. Evita dois motoboys
// aceitarem o mesmo chamado em abas diferentes.
export function transacao(fn) {
  const atual = ler();
  const resultado = fn(atual);
  if (resultado === false) { estado = atual; avisar(); return false; }
  atual.calls = podar(atual.calls);
  estado = limparEstado(atual);
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    estado = ler();
    avisar();
    throw new Error('armazenamento-cheio');
  }
  canal && canal.postMessage('sync');
  avisar();
  return true;
}

function recarregar() { estado = ler(); avisar(); }
const ouvirCanal = e => { if (e.data === 'sync') recarregar(); };
canal && canal.addEventListener('message', ouvirCanal);

// Com servidor, cada conta tem sua gaveta no aparelho (empresa e motoboy podem dividir o mesmo celular).
// Na primeira vez, aproveita perfil e dados da empresa já preenchidos sem conta.
export function usarConta(id) {
  const nova = `${BASE}:${id}`;
  if (nova === CHAVE) return;
  let existe = false;
  try { existe = localStorage.getItem(nova) != null; } catch {}
  if (!existe) {
    const antigo = ler();
    try { localStorage.setItem(nova, JSON.stringify(limparEstado({ profile: antigo.profile, empresa: antigo.empresa, saques: antigo.saques }))); } catch {}
  }
  CHAVE = nova;
  if (canal) { canal.removeEventListener('message', ouvirCanal); canal.close(); }
  canal = 'BroadcastChannel' in globalThis ? new BroadcastChannel(CHAVE) : null;
  canal && canal.addEventListener('message', ouvirCanal);
  recarregar();
}
globalThis.addEventListener?.('storage', e => { if (e.key === CHAVE) recarregar(); });

// Preferências desta aba (papel e aba aberta). Só aceita valores conhecidos.
export const sessao = {
  get(k, permitidos) {
    try { const v = sessionStorage.getItem('marcaai:' + k); return permitidos.includes(v) ? v : null; } catch { return null; }
  },
  set(k, v) {
    try { v == null ? sessionStorage.removeItem('marcaai:' + k) : sessionStorage.setItem('marcaai:' + k, v); } catch {}
  }
};
