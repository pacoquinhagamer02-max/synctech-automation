// Servidor do Marca aí (Firebase). Liga empresa e motoboy em celulares diferentes.
// O app continua desenhando tudo a partir do estado local (store.js); este módulo
// mantém esse estado igual ao do servidor e manda pra lá cada ação.
// Segurança: quem decide o que vale é firebase/firestore.rules, não este arquivo.
// A biblioteca do Firebase (170 KB) só é baixada quando o servidor é usado.
let F = null;
import { FIREBASE, NUVEM_ATIVA } from './config.js';
import { S, transacao, usarConta } from './store.js';
import { ATIVOS, r2 } from './regras.js';

const params = new URLSearchParams(location.search);
// ?demo = modo antigo, só no aparelho. ?aba = cada aba é uma conta (pra testar empresa e motoboy no mesmo navegador).
export const nuvemLigada = () => !params.has('demo') && (NUVEM_ATIVA || params.has('nuvem'));

let db = null, uid = null, papel = null;
let estado = 'desligado'; // desligado | conectando | conectado | erro
let detalheErro = '';
const ouvintes = new Set();
const parar = [];
const vistos = new Map();       // id -> dados públicos do chamado
const extras = new Map();       // id -> { cliente, codigo } (dados restritos já lidos)
const posicoes = new Map();     // motoboyUid -> posição
const ouvindoPos = new Map();   // motoboyUid -> função pra parar

export const meuUid = () => uid;
export const estadoNuvem = () => ({ estado, detalheErro });
export const aoMudarNuvem = fn => { ouvintes.add(fn); return () => ouvintes.delete(fn); };
const avisar = () => ouvintes.forEach(fn => fn(estado));

/** Liga a conexão. Chame de novo ao trocar de papel (empresa/motoboy). */
export async function conectar(novoPapel) {
  if (!nuvemLigada()) return;
  papel = novoPapel;
  if (!db) {
    estado = 'conectando'; avisar();
    try {
      F = F || await import('./vendor/firebase.js');
      const app = F.initializeApp(FIREBASE);
      const auth = F.initializeAuth(app, { persistence: params.has('aba') ? F.browserSessionPersistence : [F.indexedDBLocalPersistence, F.browserLocalPersistence] });
      db = F.initializeFirestore(app, {});
      await new Promise((ok, falha) => {
        const sair = F.onAuthStateChanged(auth, async u => {
          try {
            if (!u) { await F.signInAnonymously(auth); return; }
            uid = u.uid; sair(); ok();
          } catch (e) { sair(); falha(e); }
        }, falha);
      });
      usarConta(uid);
    } catch (e) {
      estado = 'erro';
      detalheErro = /admin-restricted|operation-not-allowed|configuration-not-found/i.test(String(e?.code || e?.message))
        ? 'O login do servidor ainda não foi ativado no Firebase.' : 'Sem conexão com o servidor. Confira a internet.';
      avisar();
      return;
    }
  }
  ouvir();
}

function ouvir() {
  parar.splice(0).forEach(f => f());
  vistos.clear();
  if (!papel || !uid) return;
  const ch = F.collection(db, 'chamados');
  const consultas = papel === 'empresa'
    ? [F.query(ch, F.where('empresaUid', '==', uid), F.orderBy('criadoEm', 'desc'), F.limit(60))]
    : [F.query(ch, F.where('status', '==', 'aberto'), F.orderBy('criadoEm', 'asc'), F.limit(30)),
       F.query(ch, F.where('motoboyUid', '==', uid), F.orderBy('criadoEm', 'desc'), F.limit(60))];
  const grupos = consultas.map(() => new Map());
  consultas.forEach((q, i) => parar.push(F.onSnapshot(q, snap => {
    grupos[i].clear();
    snap.forEach(d => grupos[i].set(d.id, d.data()));
    vistos.clear();
    grupos.forEach(g => g.forEach((v, k) => vistos.set(k, v)));
    estado = 'conectado'; detalheErro = ''; avisar();
    buscarExtras();
    acompanharPosicoes();
    espelhar();
  }, () => { estado = 'erro'; detalheErro = 'O servidor recusou a leitura. Tente sair e entrar de novo.'; avisar(); })));
}

// Dados do cliente e código: lidos uma vez quando a regra deixa (empresa dona; motoboy depois do aceite).
function buscarExtras() {
  vistos.forEach((c, id) => {
    const souEmpresa = c.empresaUid === uid, souMotoboy = c.motoboyUid === uid;
    const ex = extras.get(id) || {};
    if (!ex.cliente && (souEmpresa || souMotoboy) && !ex.pedindoCliente) {
      ex.pedindoCliente = true;
      F.getDoc(F.doc(db, 'chamados', id, 'restrito', 'cliente')).then(s => { ex.cliente = s.data() || null; espelhar(); }).catch(() => { ex.pedindoCliente = false; });
    }
    if (!ex.codigo && souEmpresa && !ex.pedindoCodigo) {
      ex.pedindoCodigo = true;
      F.getDoc(F.doc(db, 'chamados', id, 'restrito', 'codigo')).then(s => { ex.codigo = s.data()?.valor || ''; espelhar(); }).catch(() => { ex.pedindoCodigo = false; });
    }
    extras.set(id, ex);
  });
}

// Empresa acompanha a posição dos motoboys das suas corridas em andamento.
function acompanharPosicoes() {
  if (papel !== 'empresa') return;
  const ativos = new Set([...vistos.values()].filter(c => c.motoboyUid && ATIVOS.includes(c.status)).map(c => c.motoboyUid));
  ouvindoPos.forEach((sair, m) => { if (!ativos.has(m)) { sair(); ouvindoPos.delete(m); posicoes.delete(m); } });
  ativos.forEach(m => {
    if (ouvindoPos.has(m)) return;
    ouvindoPos.set(m, F.onSnapshot(F.doc(db, 'posicoes', m), s => { if (s.exists()) posicoes.set(m, s.data()); else posicoes.delete(m); espelhar(); }, () => {}));
  });
}

const bairroDe = endereco => {
  const partes = String(endereco || '').split(',').map(x => x.trim()).filter(Boolean);
  return partes.length > 1 ? partes[partes.length - 1] : 'Mariana';
};

// Converte o documento do servidor no formato que as telas já usam.
function paraLocal(id, c) {
  const ex = extras.get(id) || {}, cli = ex.cliente;
  const pos = c.motoboyUid ? posicoes.get(c.motoboyUid) : null;
  return {
    ...c, id, nuvem: true,
    motoboyUid: c.motoboyUid || '',
    entrega: cli?.entrega || `Entrega no bairro ${c.bairro || 'informado após o aceite'}`,
    cliente: cli?.cliente || '', telCliente: cli?.telCliente || '', clienteGeo: cli?.clienteGeo || null,
    codigo: ex.codigo || '0000',
    // As telas checam favoritos pelo nome; aqui só importa se EU sou favorito.
    preferidos: (c.preferidosUid || []).includes(uid) ? [S().profile.nome] : ((c.preferidosUid || []).length ? ['outros'] : []),
    posMotoboy: pos && pos.chamadoId === id ? { lat: pos.lat, lon: pos.lon, em: pos.em } : null
  };
}

function espelhar() {
  transacao(s => {
    const locais = s.calls.filter(c => !c.nuvem);
    s.calls = [...locais, ...[...vistos.entries()].map(([id, c]) => paraLocal(id, c))];
  });
}

/* ============ Ações (o servidor confere cada uma) ============ */
const precisa = () => { if (!db || !uid) throw new Error('sem-servidor'); };
export const erroRecusado = e => /permission|insufficient/i.test(String(e?.code || e?.message));

export async function criarChamado(c) {
  precisa();
  const ref = F.doc(F.collection(db, 'chamados'));
  const b = F.writeBatch(db);
  b.set(ref, {
    empresaUid: uid, empresa: c.empresa, coleta: c.coleta, tel: c.tel || '', lojaGeo: c.lojaGeo || null, bairro: bairroDe(c.entrega),
    km: c.km, chuva: !!c.chuva, valor: c.valor, taxa: c.taxa, obs: c.obs || '', status: 'aberto', criadoEm: Date.now(),
    motoboyUid: null, preferidosUid: c.preferidosUid || [], prioridadeAte: c.prioridadeAte || null, temGeoCliente: !!c.clienteGeo
  });
  b.set(F.doc(db, 'chamados', ref.id, 'restrito', 'codigo'), { valor: c.codigo });
  b.set(F.doc(db, 'chamados', ref.id, 'restrito', 'cliente'), { entrega: c.entrega, cliente: c.cliente || '', telCliente: c.telCliente || '', clienteGeo: c.clienteGeo || null });
  await b.commit();
  extras.set(ref.id, { codigo: c.codigo, cliente: { entrega: c.entrega, cliente: c.cliente || '', telCliente: c.telCliente || '', clienteGeo: c.clienteGeo || null } });
  return ref.id;
}

const atualizar = (id, dados) => { precisa(); return F.updateDoc(F.doc(db, 'chamados', id), dados); };
export const aceitar = (id, p) => atualizar(id, { status: 'aceito', motoboyUid: uid, motoboy: p.nome, moto: p.moto || '', placa: p.placa || '', aceitoEm: Date.now() });
export const chegou = (id, kmReal, porGps) => atualizar(id, { status: 'coleta', chegouEm: Date.now(), chegadaGps: !!porGps, kmReal: r2(kmReal || 0) });
export const coletou = (id, espera, kmReal, quando) => atualizar(id, { status: 'coletado', coletouEm: quando, espera, kmReal: r2(kmReal || 0) });
export const entregar = (id, codigo, kmReal) => atualizar(id, { status: 'entregue', entregueEm: Date.now(), codigoInformado: codigo, kmReal: r2(kmReal || 0) });
export const salvarKm = (id, kmReal) => atualizar(id, { kmReal: r2(kmReal) });
export const avaliar = (id, nota, tags) => atualizar(id, { avaliado: true, nota: Math.round(nota), tags });
export const cancelar = (id, compensacao) => atualizar(id, { status: 'cancelado', canceladoEm: Date.now(), compensacao });
export const gorjeta = (id, valor) => atualizar(id, { gorjeta: valor });

// Posição do motoboy: só sobe com corrida em andamento, e some quando ela acaba.
export function enviarPosicao(ponto, chamadoId) {
  if (!db || !uid) return Promise.resolve();
  return F.setDoc(F.doc(db, 'posicoes', uid), { lat: ponto.lat, lon: ponto.lon, precisao: Math.round(ponto.precisao || 0), em: Date.now(), chamadoId }).catch(() => {});
}
export function apagarPosicao() {
  if (!db || !uid) return Promise.resolve();
  return F.deleteDoc(F.doc(db, 'posicoes', uid)).catch(() => {});
}
