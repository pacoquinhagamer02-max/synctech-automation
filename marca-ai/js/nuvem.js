// Servidor do Marca aí (Firebase). Liga empresa e motoboy em celulares diferentes.
// O app continua desenhando tudo a partir do estado local (store.js); este módulo
// mantém esse estado igual ao do servidor e manda pra lá cada ação.
// Segurança: quem decide o que vale é firebase/firestore.rules, não este arquivo.
// A biblioteca do Firebase (170 KB) só é baixada quando o servidor é usado.
let F = null;
import { FIREBASE, NUVEM_ATIVA } from './config.js';
import { S, transacao, usarConta } from './store.js';
import { ATIVOS, gradeAproximada } from './regras.js';

const params = new URLSearchParams(location.search);
// ?demo = modo antigo, só no aparelho. ?aba = cada aba é uma conta (pra testar empresa e motoboy no mesmo navegador).
export const nuvemLigada = () => !params.has('demo') && (NUVEM_ATIVA || params.has('nuvem'));

let db = null, uid = null, papel = null, auth = null;
let estado = 'desligado'; // desligado | conectando | conectado | erro
let detalheErro = '';
const ouvintes = new Set();
const parar = [];
const vistos = new Map();       // id -> dados públicos do chamado
const turnosVistos = new Map(); // id -> turno
const extras = new Map();       // id -> { cliente, codigo } (dados restritos já lidos)
const posicoes = new Map();     // motoboyUid -> posição
const ouvindoPos = new Map();   // motoboyUid -> função pra parar
let disponiveis = [];           // motoboys livres perto (grade de ~1 km, sem nome), visto pela empresa
const DISPONIVEL_VALE_MS = 5 * 60000;

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
      auth = F.initializeAuth(app, { persistence: params.has('aba') ? F.browserSessionPersistence : [F.indexedDBLocalPersistence, F.browserLocalPersistence] });
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
    // 200 últimos: dá pro relatório do mês da loja sem ler o histórico inteiro.
    ? [F.query(ch, F.where('empresaUid', '==', uid), F.orderBy('criadoEm', 'desc'), F.limit(200))]
    : [F.query(ch, F.where('status', '==', 'aberto'), F.orderBy('criadoEm', 'asc'), F.limit(30)),
       F.query(ch, F.where('motoboyUid', '==', uid), F.orderBy('criadoEm', 'desc'), F.limit(60))];
  const grupos = consultas.map(() => new Map());
  // Turnos: a loja vê os dela; o motoboy vê os abertos e os que pegou.
  const tu = F.collection(db, 'turnos');
  const consultasTurno = papel === 'empresa'
    ? [F.query(tu, F.where('empresaUid', '==', uid), F.orderBy('inicio', 'desc'), F.limit(60))]
    : [F.query(tu, F.where('status', '==', 'aberto'), F.orderBy('inicio', 'asc'), F.limit(30)),
       F.query(tu, F.where('motoboyUid', '==', uid), F.orderBy('inicio', 'desc'), F.limit(60))];
  const gruposTurno = consultasTurno.map(() => new Map());
  turnosVistos.clear();
  consultasTurno.forEach((q, i) => parar.push(F.onSnapshot(q, snap => {
    gruposTurno[i].clear();
    snap.forEach(d => gruposTurno[i].set(d.id, d.data()));
    turnosVistos.clear();
    gruposTurno.forEach(g => g.forEach((v, k) => turnosVistos.set(k, v)));
    espelhar();
  }, () => {})));
  // Empresa conta os motoboys livres perto da loja (como os carrinhos no mapa da Uber/Lalamove).
  if (papel === 'empresa') {
    parar.push(F.onSnapshot(F.query(F.collection(db, 'disponiveis'), F.orderBy('em', 'desc'), F.limit(300)), snap => {
      disponiveis = snap.docs.map(d => d.data());
      avisar();
    }, () => { disponiveis = []; }));
  }
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
      F.getDoc(F.doc(db, 'chamados', id, 'restrito', 'cliente')).then(s => {
        ex.cliente = s.data() || null; if (!ex.cliente) ex.pedindoCliente = false;
        espelhar();
        // Motoboy acabou de aceitar: o link do cliente já mostra o nome dele e a etapa.
        if (souMotoboy && ATIVOS.includes(c.status)) atualizarRastreio(id, {});
      }).catch(() => { ex.pedindoCliente = false; });
    }
    if (!ex.codigo && souEmpresa && !ex.pedindoCodigo) {
      ex.pedindoCodigo = true;
      F.getDoc(F.doc(db, 'chamados', id, 'restrito', 'codigo')).then(s => { ex.codigo = s.data()?.valor || ''; ex.codigos = s.data()?.valores || [ex.codigo]; espelhar(); }).catch(() => { ex.pedindoCodigo = false; });
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
    ouvindoPos.set(m, F.onSnapshot(F.doc(db, 'posicoes', m), s => { if (s.exists()) posicoes.set(m, s.data()); else posicoes.delete(m); espelhar(); },
      // Escuta caiu (rede ou regra): solta e tenta de novo em 5 s.
      () => { ouvindoPos.delete(m); setTimeout(acompanharPosicoes, 5000); }));
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
  const n = Math.max(1, c.nParadas || 1), codigos = ex.codigos || [ex.codigo || '0000'];
  // Antes do aceite o motoboy só sabe o bairro de cada entrega; endereço e cliente vêm depois (regra do servidor).
  // Chamado de uma entrega só guarda a forma de pagamento no próprio chamado.
  const lista = cli?.paradas?.length ? cli.paradas : cli ? [{ cobranca: c.cobranca, ...cli }] : [];
  const paradas = Array.from({ length: n }, (_, i) => {
    const p = lista[i];
    return p ? { ...p, codigo: codigos[i] || '0000' }
      : { entrega: `Entrega no bairro ${(c.bairros || [])[i] || c.bairro || 'informado após o aceite'}`, cobranca: c.cobranca, codigo: codigos[i] || '0000' };
  });
  (c.paradaEm || []).forEach((t, i) => { if (paradas[i]) paradas[i].entregueEm = t; });
  if (c.status === 'entregue' && c.entregueEm && paradas[n - 1]) paradas[n - 1].entregueEm = paradas[n - 1].entregueEm || c.entregueEm;
  return {
    ...c, id, nuvem: true,
    motoboyUid: c.motoboyUid || '',
    paradas, entregues: c.entregues || 0,
    // As telas checam favoritos pelo nome; aqui só importa se EU sou favorito.
    preferidos: (c.preferidosUid || []).includes(uid) ? [S().profile.nome] : ((c.preferidosUid || []).length ? ['outros'] : []),
    posMotoboy: pos && pos.chamadoId === id ? { lat: pos.lat, lon: pos.lon, em: pos.em } : null
  };
}

function espelhar() {
  transacao(s => {
    const locais = s.calls.filter(c => !c.nuvem);
    s.calls = [...locais, ...[...vistos.entries()].map(([id, c]) => paraLocal(id, c))];
    s.turnos = [...(s.turnos || []).filter(t => !t.nuvem), ...[...turnosVistos.entries()].map(([id, t]) => ({ ...t, id, nuvem: true }))];
  });
}

/* ============ Adaptador "armazém do servidor" (porta de corridas.js) ============
   O servidor confere cada mudança (firebase/firestore.rules). Recusa vira { motivo: 'recusado' }. */
export const erroRecusado = e => /permission|insufficient/i.test(String(e?.code || e?.message));
const traduzir = e => Object.assign(new Error(e?.message || 'erro'), { motivo: erroRecusado(e) ? 'recusado' : 'sem-conexao' });
const precisa = () => { if (!db || !uid) throw Object.assign(new Error('sem-servidor'), { motivo: 'sem-conexao' }); };

/** Motoboys livres vistos há menos de 5 min (posição aproximada, sem nome). */
export const disponiveisAgora = () => disponiveis.filter(d => Date.now() - d.em < DISPONIVEL_VALE_MS);

// Motoboy livre avisa que está disponível, com posição aproximada (~1 km). Regrava se mudar de quadra ou a cada 2 min.
let ultimoDisponivel = null;
export function publicarDisponivel(ponto) {
  if (!db || !uid || !ponto) return;
  const g = gradeAproximada(ponto);
  const u = ultimoDisponivel;
  if (u && u.latC === g.latC && u.lonC === g.lonC && Date.now() - u.em < 120000) return;
  ultimoDisponivel = { ...g, em: Date.now() };
  F.setDoc(F.doc(db, 'disponiveis', uid), ultimoDisponivel).catch(() => { ultimoDisponivel = null; });
}
export function esquecerDisponivel() {
  if (!db || !uid || !ultimoDisponivel) return;
  ultimoDisponivel = null;
  F.deleteDoc(F.doc(db, 'disponiveis', uid)).catch(() => {});
}

/* ============ Link de rastreio do cliente ============
   Motoboy da corrida grava etapa, nome/moto/placa e posição; empresa só marca "cancelado".
   O servidor confere que a etapa é a mesma do chamado. Falha aqui nunca atrapalha a corrida. */
const rastreioGravadoEm = new Map();
// Cada cliente tem o seu link. Parada já entregue mostra "entregue"; as que faltam seguem a etapa da corrida.
function atualizarRastreio(id, { status, pos, empresa = false }) {
  if (!db || !uid) return;
  const c = S().calls.find(x => x.id === id);
  if (!c) return;
  const etapaCorrida = status || c.status;
  const feitas = etapaCorrida === 'entregue' ? c.paradas.length : (c.entregues || 0);
  c.paradas.forEach((p, i) => {
    const token = p.rastreio;
    if (!token) return;
    // Parada já entregue não é regravada a cada leitura do GPS.
    if (i < (c.entregues || 0) && pos !== undefined && etapaCorrida !== 'entregue') return;
    const etapa = i < feitas ? 'entregue' : etapaCorrida;
    // Entrega terminada: some a posição e também os pontos da loja e do cliente (o link deixa de guardar endereço).
    const fim = ['entregue', 'cancelado'].includes(etapa) ? { pos: null, lojaGeo: null, destinoGeo: null } : {};
    const dados = empresa ? { status: etapa, pos: null, em: Date.now(), ...fim }
      : { status: etapa, motoboy: S().profile.nome || '', moto: S().profile.moto || '', placa: S().profile.placa || '', em: Date.now(),
          ...(pos !== undefined ? { pos } : {}), ...(ATIVOS.includes(etapa) ? {} : { pos: null }), ...fim };
    F.updateDoc(F.doc(db, 'rastreios', token), dados).catch(() => {});
  });
  rastreioGravadoEm.set(id, Date.now());
}

/* ============ Foto da entrega ============
   Fica no próprio banco (Firestore), em JPEG pequeno (~60 KB), sem precisar do Storage pago.
   Só o motoboy da corrida grava; só ele e a loja leem. */
export async function enviarFoto(id, parada, dataUrl) {
  precisa();
  try { await F.setDoc(F.doc(db, 'chamados', id, 'fotos', String(parada)), { img: dataUrl, em: Date.now() }); }
  catch (e) { throw traduzir(e); }
}
export async function lerFoto(id, parada) {
  precisa();
  try { const s = await F.getDoc(F.doc(db, 'chamados', id, 'fotos', String(parada))); return s.data()?.img || null; }
  catch (e) { throw traduzir(e); }
}

/* ============ Login por telefone (SMS) ============
   Liga o número à conta que já existe neste aparelho (o histórico continua o mesmo) e, num celular
   novo, entra na mesma conta. O Firebase exige um reCAPTCHA invisível antes de mandar o SMS. */
let confirmacao = null, verificador = null;
export const telefoneDaConta = () => auth?.currentUser?.phoneNumber || '';
const ERROS_SMS = {
  'auth/invalid-phone-number': 'Número inválido. Use DDD + número, ex.: (31) 99999-9999.',
  'auth/too-many-requests': 'Muitas tentativas. Espere alguns minutos e tente de novo.',
  'auth/quota-exceeded': 'O limite de SMS do dia acabou. Tente amanhã.',
  'auth/invalid-verification-code': 'Código errado. Confira o SMS e digite de novo.',
  'auth/code-expired': 'O código venceu. Peça um novo.',
  'auth/operation-not-allowed': 'O login por telefone ainda não foi ativado no servidor.',
  'auth/billing-not-enabled': 'O login por telefone ainda não foi ativado no servidor.',
  'auth/admin-restricted-operation': 'O login por telefone ainda não foi ativado no servidor.',
  'auth/invalid-app-credential': 'O login por telefone ainda não foi ativado no servidor.',
  'auth/captcha-check-failed': 'Não deu pra confirmar que você não é robô. Tente de novo.',
  'auth/network-request-failed': 'Sem internet. Confira a conexão e tente de novo.'
};
export const erroSms = e => {
  // O código do erro fica no console pra quem for ativar o login por SMS no Firebase saber o que falta.
  console.warn('[Marca aí] login por SMS:', e?.code || e?.message);
  return ERROS_SMS[e?.code] || 'Não deu pra mandar o SMS agora. Tente de novo em instantes.';
};

/** +55 e só dígitos. Aceita (31) 99999-9999, 31999999999 ou +5531999999999. */
export function numeroE164(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return /^55\d{10,11}$/.test(d) ? '+' + d : '';
}

export async function enviarSms(telefone, idBotao) {
  if (!auth?.currentUser) throw Object.assign(new Error('sem-servidor'), { code: 'auth/network-request-failed' });
  const numero = numeroE164(telefone);
  if (!numero) throw Object.assign(new Error('numero'), { code: 'auth/invalid-phone-number' });
  verificador?.clear?.();
  verificador = new F.RecaptchaVerifier(auth, idBotao, { size: 'invisible' });
  auth.languageCode = 'pt-BR';
  try {
    // Conta deste aparelho ganha o telefone (mesmo histórico). Se ela já tem outro número, entra pela conta do número.
    confirmacao = auth.currentUser.isAnonymous && !auth.currentUser.phoneNumber
      ? { tipo: 'ligar', r: await F.linkWithPhoneNumber(auth.currentUser, numero, verificador) }
      : { tipo: 'entrar', r: await F.signInWithPhoneNumber(auth, numero, verificador) };
  } catch (e) { verificador?.clear?.(); verificador = null; throw e; }
  return numero;
}

/** Confirma o código do SMS. Devolve 'ligado' (este aparelho ganhou o telefone) ou 'entrou' (abriu a conta que já tinha o número). */
export async function confirmarSms(codigo) {
  if (!confirmacao) throw Object.assign(new Error('sem-sms'), { code: 'auth/code-expired' });
  try {
    await confirmacao.r.confirm(String(codigo).replace(/\D/g, ''));
    const tipo = confirmacao.tipo === 'ligar' ? 'ligado' : 'entrou';
    confirmacao = null;
    if (tipo === 'entrou') trocarDeConta();
    avisar();
    return tipo;
  } catch (e) {
    // O número já é de outra conta (outro celular): entra nela em vez de ligar a esta.
    if (e?.code === 'auth/credential-already-in-use' || e?.code === 'auth/account-exists-with-different-credential') {
      const cred = F.PhoneAuthProvider.credentialFromError(e);
      if (cred) { await F.signInWithCredential(auth, cred); confirmacao = null; trocarDeConta(); avisar(); return 'entrou'; }
    }
    throw e;
  }
}

// Entrou em outra conta: troca a gaveta de dados do aparelho e volta a ouvir o servidor com o novo dono.
function trocarDeConta() {
  uid = auth.currentUser.uid;
  usarConta(uid);
  extras.clear(); vistos.clear(); turnosVistos.clear();
  ouvir();
}

export const armazemNuvem = {
  lista: () => S().calls,

  async criar(c) {
    precisa();
    const ref = F.doc(F.collection(db, 'chamados'));
    const paradas = c.paradas?.length ? c.paradas : [c];
    const privada = p => ({ entrega: p.entrega, cliente: p.cliente || '', telCliente: p.telCliente || '', clienteGeo: p.clienteGeo || null,
      cobranca: p.cobranca || 'pago', cobrar: p.cobrar || 0, troco: p.troco || 0, rastreio: p.rastreio || '' });
    const p0 = privada(paradas[0]);
    const cliente = { entrega: p0.entrega, cliente: p0.cliente, telCliente: p0.telCliente, clienteGeo: p0.clienteGeo, cobrar: p0.cobrar, troco: p0.troco, rastreio: p0.rastreio,
      ...(paradas.length > 1 ? { paradas: paradas.map(privada), rastreios: paradas.map(p => p.rastreio || '') } : {}) };
    // Antes do aceite o motoboy vê como o cliente paga (o caso que mais exige entre as paradas), nunca o valor.
    const cobranca = paradas.some(p => p.cobranca === 'maquininha') ? 'maquininha' : paradas.some(p => p.cobranca === 'dinheiro') ? 'dinheiro' : 'pago';
    const b = F.writeBatch(db);
    b.set(ref, {
      empresaUid: uid, empresa: c.empresa, coleta: c.coleta, tel: c.tel || '', lojaGeo: c.lojaGeo || null, bairro: bairroDe(paradas[0].entrega),
      km: c.km, chuva: !!c.chuva, valor: c.valor, taxa: c.taxa, obs: c.obs || '', status: 'aberto', criadoEm: c.criadoEm,
      motoboyUid: null, preferidosUid: c.preferidosUid || [], prioridadeAte: c.preferidosUid?.length ? c.prioridadeAte : null, temGeoCliente: !!paradas[0].clienteGeo, raioKm: c.raioKm,
      cobranca, volta: !!c.volta, nParadas: paradas.length, entregues: 0, bairros: paradas.map(p => bairroDe(p.entrega))
    });
    b.set(F.doc(db, 'chamados', ref.id, 'restrito', 'codigo'), { valor: paradas[0].codigo, valores: paradas.map(p => p.codigo) });
    b.set(F.doc(db, 'chamados', ref.id, 'restrito', 'cliente'), cliente);
    // Página pública de cada cliente (sem nome nem telefone): só quem recebe o link acha.
    paradas.forEach((p, i) => {
      if (p.rastreio) b.set(F.doc(db, 'rastreios', p.rastreio), { chamadoId: ref.id, parada: i, empresa: c.empresa, lojaGeo: c.lojaGeo || null, destinoGeo: p.clienteGeo || null,
        status: 'aberto', motoboy: '', moto: '', placa: '', pos: null, em: Date.now() });
    });
    try { await b.commit(); } catch (e) { throw traduzir(e); }
    // A empresa já sabe os códigos e os dados dos clientes: guarda e redesenha (sem esperar uma nova leitura).
    extras.set(ref.id, { ...(extras.get(ref.id) || {}), codigo: paradas[0].codigo, codigos: paradas.map(p => p.codigo), cliente });
    espelhar();
    return ref.id;
  },

  async aplicar(id, m) {
    precisa();
    const ref = F.doc(db, 'chamados', id);
    // Entrega em dois passos: 1) grava o palpite do código (o servidor conta, no máximo 5);
    // 2) pede "entregue", que o servidor só aceita se o palpite gravado estiver certo.
    // Entrega (de cada parada) em dois passos: 1) grava o palpite do código daquela parada (o servidor conta,
    // no máximo 5); 2) marca a parada como entregue, que o servidor só aceita se o palpite gravado estiver certo.
    if ('entregues' in m) {
      const c = S().calls.find(x => x.id === id), i = c?.entregues || 0;
      const feitas = c?.tentativas || 0;
      if (feitas >= 5) throw Object.assign(new Error('bloqueado'), { motivo: 'bloqueado' });
      try { await F.updateDoc(ref, { codigoInformado: m.codigoInformado, codigoParada: i, tentativas: feitas + 1 }); } catch (e) { throw traduzir(e); }
      const passo = m.status === 'entregue'
        ? { status: 'entregue', entregueEm: m.entregueEm, kmReal: m.kmReal, entregues: m.entregues }
        : { entregues: m.entregues, tentativas: 0, kmReal: m.kmReal, paradaEm: [...(vistos.get(id)?.paradaEm || []), m.paradaEm] };
      try { await F.updateDoc(ref, passo); } catch (e) { throw traduzir(e); }
      atualizarRastreio(id, m.status === 'entregue' ? { status: 'entregue', pos: null } : {});
      return;
    }
    // Quem aceita é sempre esta conta: o servidor confere que motoboyUid é de quem está pedindo.
    const dados = m.status === 'aceito' ? { ...m, motoboyUid: uid } : m;
    try { await F.updateDoc(ref, dados); } catch (e) { throw traduzir(e); }
    if (m.status === 'cancelado') atualizarRastreio(id, { status: 'cancelado', pos: null, empresa: true });
    else if (m.status) atualizarRastreio(id, { status: m.status });
  },

  // Posição do motoboy: só sobe com corrida em andamento, e some quando ela acaba.
  publicarPosicao(ponto, corrida) {
    if (!db || !uid || !corrida) return;
    F.setDoc(F.doc(db, 'posicoes', uid), { lat: ponto.lat, lon: ponto.lon, precisao: Math.round(ponto.precisao || 0), em: Date.now(), chamadoId: corrida.id }).catch(() => {});
    // O cliente vê a moto andando no link dele (no máximo uma gravação a cada 5 s).
    if (Date.now() - (rastreioGravadoEm.get(corrida.id) || 0) >= 5000) atualizarRastreio(corrida.id, { pos: { lat: ponto.lat, lon: ponto.lon } });
  },
  esquecerPosicao() {
    if (!db || !uid) return;
    F.deleteDoc(F.doc(db, 'posicoes', uid)).catch(() => {});
  },

  // Turnos (reserva de motoboy por hora). O servidor confere horário, valor e quem pode mudar o quê.
  listaTurnos: () => S().turnos || [],
  async criarTurno(t) {
    precisa();
    const ref = F.doc(F.collection(db, 'turnos'));
    try {
      await F.setDoc(ref, { empresaUid: uid, empresa: t.empresa, coleta: t.coleta, tel: t.tel || '', lojaGeo: t.lojaGeo || null, obs: t.obs || '',
        inicio: t.inicio, fim: t.fim, valorHora: t.valorHora, status: 'aberto', criadoEm: t.criadoEm, motoboyUid: null });
    } catch (e) { throw traduzir(e); }
    return ref.id;
  },
  async aplicarTurno(id, m) {
    precisa();
    const dados = m.status === 'aceito' ? { ...m, motoboyUid: uid } : m;
    try { await F.updateDoc(F.doc(db, 'turnos', id), dados); } catch (e) { throw traduzir(e); }
  }
};

// Só no modo de teste (?aba): dá acesso ao banco pra testar se as regras do servidor barram fraude.
// No app normal devolve null. Isso não abre brecha: quem decide são as regras, não o app.
export const bancoParaTestes = () => (params.has('aba') && db ? { db, F, uid } : null);
