// Único ponto do app que lê e grava dados.
// Hoje: localStorage + BroadcastChannel (abas do mesmo aparelho).
// Quando tiver servidor, só este arquivo muda; as telas continuam iguais.
import { limparEstado } from './esquema.js';
import { ATIVOS, LIMITES } from './regras.js';

const CHAVE = 'marcaai:v1';
const canal = 'BroadcastChannel' in globalThis ? new BroadcastChannel('marcaai') : null;
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
canal && canal.addEventListener('message', e => { if (e.data === 'sync') recarregar(); });
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
