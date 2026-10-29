// Página do cliente: acompanha a entrega no mapa, ao vivo (como o link do iFood Sob Demanda e da Lalamove).
// Abre por rastreio.html#<segredo>. O segredo fica depois do #, então não vai pra log de servidor nem referrer.
// Não mostra nome, telefone nem código do cliente: só a loja, a etapa, o motoboy e a posição da moto.
import { html, esc } from './ui.js';
import { mapaVivo, montarMapas, infoRota, aoMudarRota } from './mapa-vivo.js';
import { TOKEN_RASTREIO } from './regras.js';
import { FIREBASE, NUVEM_ATIVA } from './config.js';

const app = document.getElementById('app');
// Link cortado ou com % estranho não pode derrubar a página: vira "link não encontrado".
const token = (() => { try { return decodeURIComponent(location.hash.slice(1)); } catch { return ''; } })();
const params = new URLSearchParams(location.search);
const naNuvem = !params.has('demo') && NUVEM_ATIVA;
let dados = null, estado = 'carregando'; // carregando | ok | nao-achou | erro

const logo = `<svg class="pin" viewBox="0 0 24 24" aria-hidden="true"><path fill="#FFC21A" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.6" fill="#0A0A0A"/></svg>`;
const ETAPAS = ['Indo à loja', 'Na loja', 'A caminho de você', 'Entregue'];
const PASSO = { aberto: 0, aceito: 0, coleta: 1, coletado: 2, entregue: 3 };
const FASE = { aberto: 'oferta', aceito: 'loja', coleta: 'naloja', coletado: 'cliente' };
const minTxt = n => (n === 1 ? '1 minuto' : `${n} minutos`);

function titulo(d) {
  const quem = d.motoboy ? esc(d.motoboy) : 'O motoboy';
  const eta = infoRota(token);
  switch (d.status) {
    case 'aberto': return ['Procurando motoboy', `A ${esc(d.empresa)} já chamou um motoboy pro seu pedido.`];
    case 'aceito': return [`${quem} está indo buscar seu pedido`, `Ele vai até a ${esc(d.empresa)} e depois segue pra você.`];
    case 'coleta': return [`${quem} está na loja`, 'Assim que o pedido sair, você acompanha a moto no mapa.'];
    case 'coletado': return [eta?.min ? `Chega em ${minTxt(eta.min)}` : 'Seu pedido saiu pra entrega', `${quem} está a caminho${eta ? `, a ${eta.km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : ''}.${d.parada > 0 ? ` Ele leva outros pedidos na mesma rota e o seu é a ${d.parada + 1}ª entrega.` : ''} Tenha o código de entrega em mãos.`];
    case 'entregue': return ['Pedido entregue', `Bom apetite! Entrega feita por ${quem} pelo Marca aí.`];
    case 'cancelado': return ['Entrega cancelada', `Fale com a ${esc(d.empresa)} pra saber o que aconteceu.`];
    default: return ['Acompanhando seu pedido', ''];
  }
}

function desenhar() {
  let corpo;
  if (estado === 'carregando') corpo = '<div class="vazio"><b>Carregando sua entrega…</b></div>';
  else if (estado !== 'ok') corpo = `<div class="vazio"><b>${estado === 'erro' ? 'Sem conexão agora' : 'Link não encontrado'}</b>${estado === 'erro'
    ? 'Confira a internet. A página tenta de novo sozinha.' : 'Confira se o link chegou inteiro na mensagem da loja.'}</div>`;
  else {
    const d = dados, [t, sub] = titulo(d), passo = PASSO[d.status];
    const fase = FASE[d.status];
    const moto = d.pos ? { ...d.pos, em: d.em } : null;
    corpo = `<section class="cascata" data-tela="rastreio-${esc(d.status)}">
      <p class="olho">Pedido da ${esc(d.empresa)}</p>
      <h1 class="rastreio-titulo">${t}</h1>
      ${sub ? `<p class="lead rastreio-sub">${sub}</p>` : ''}
      ${passo != null ? `<ol class="passos" aria-label="Etapa ${passo + 1} de 4: ${ETAPAS[passo]}">${ETAPAS.map((n, i) =>
        `<li class="${i < passo || d.status === 'entregue' ? 'feito' : i === passo ? 'agora' : ''}" ${i === passo ? 'aria-current="step"' : ''}>${n}</li>`).join('')}</ol>` : ''}
      ${fase && (d.lojaGeo || d.destinoGeo || moto) ? mapaVivo(token, { loja: d.lojaGeo, cliente: d.destinoGeo, moto, fase, rotulo: t.replace(/<[^>]*>/g, '') }) : ''}
      ${d.motoboy && ['aceito', 'coleta', 'coletado'].includes(d.status) ? `<div class="bloco motoboy-card">
        <div class="avatar" aria-hidden="true">${esc(d.motoboy.slice(0, 1).toUpperCase())}</div>
        <div><b>${esc(d.motoboy)}</b><small>${[d.moto, d.placa && `placa ${d.placa}`].filter(Boolean).map(esc).join(' · ') || 'Motoboy do Marca aí'}</small></div>
      </div>` : ''}
      ${d.status === 'coletado' ? '<p class="aviso">Na hora da entrega, diga ao motoboy o código de 4 números que a loja mandou na mensagem.</p>' : ''}
    </section>`;
  }
  html(app, `<header class="top"><div class="top-linha"><div class="logo" translate="no">${logo}Marca aí</div></div></header>
    <main id="view">${corpo}</main>
    <p class="demo centro rodape-rastreio">Entrega feita por motoboy do Marca aí, o app que trabalha pro motoboy.</p>`);
  montarMapas();
}

/* ---------- de onde vêm os dados ---------- */
async function ouvirNuvem() {
  try {
    const F = await import('./vendor/firebase.js');
    const db = F.initializeFirestore(F.initializeApp(FIREBASE, 'rastreio'), {});
    F.onSnapshot(F.doc(db, 'rastreios', token), s => {
      if (!s.exists()) { estado = 'nao-achou'; dados = null; } else { estado = 'ok'; dados = s.data(); }
      desenhar();
    }, () => { estado = 'erro'; desenhar(); setTimeout(ouvirNuvem, 10000); });
  } catch { estado = 'erro'; desenhar(); setTimeout(ouvirNuvem, 10000); }
}

// Modo demonstração: procura o chamado nas contas deste aparelho (empresa e motoboy em abas diferentes).
function lerLocal() {
  let achado = null, pos = null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith('marcaai:v1')) continue;
      const s = JSON.parse(localStorage.getItem(k) || 'null');
      const c = s?.calls?.find(x => x.rastreio === token);
      if (c && !achado) achado = c;
      if (s?.posicao && (!pos || s.posicao.em > pos.em)) pos = s.posicao;
    }
  } catch {}
  if (!achado) { estado = 'nao-achou'; dados = null; return; }
  const ativo = ['aceito', 'coleta', 'coletado'].includes(achado.status);
  estado = 'ok';
  dados = { empresa: achado.empresa, status: achado.status, lojaGeo: achado.lojaGeo, destinoGeo: achado.clienteGeo,
    motoboy: achado.motoboy || '', moto: achado.moto || '', placa: achado.placa || '',
    pos: ativo && pos && Date.now() - pos.em < 120000 ? { lat: pos.lat, lon: pos.lon } : null, em: pos?.em || 0 };
}

if (!TOKEN_RASTREIO.test(token)) { estado = 'nao-achou'; desenhar(); }
else if (naNuvem) { desenhar(); ouvirNuvem(); }
else {
  lerLocal(); desenhar();
  addEventListener('storage', () => { lerLocal(); desenhar(); });
  setInterval(() => { lerLocal(); desenhar(); }, 5000);
}
aoMudarRota(desenhar);
