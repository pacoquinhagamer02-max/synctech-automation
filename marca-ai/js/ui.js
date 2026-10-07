// Ferramentas de tela: formatação, escape de HTML, avisos e diálogos.

// Escapa tudo que veio de usuário antes de entrar num template HTML.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const brl = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const km = v => (+v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
export const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
export const hora = t => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const dia = t => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
export const ic = (id, extra = '') => `<svg aria-hidden="true" focusable="false" ${extra}><use href="#i-${id}"/></svg>`;

// Telefone só com dígitos, com DDI 55 quando faltar. Nunca entra texto livre em tel: ou wa.me.
export const fone = t => { let d = String(t || '').replace(/\D/g, ''); if (d.length === 10 || d.length === 11) d = '55' + d; return /^\d{12,13}$/.test(d) ? d : ''; };
export const mapsUrl = a => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a);
export const wazeUrl = a => 'https://waze.com/ul?navigate=yes&q=' + encodeURIComponent(a);

// Único lugar que escreve HTML na página. Com Trusted Types ligado no CSP,
// qualquer outro innerHTML (por exemplo, injetado por extensão ou bug futuro) é bloqueado.
const SCRIPTS_PERMITIDOS = ['sw.js'];
const regrasTT = {
  createHTML: s => s,
  createScriptURL: u => { if (SCRIPTS_PERMITIDOS.includes(u)) return u; throw new TypeError('script bloqueado: ' + u); }
};
const politica = globalThis.trustedTypes?.createPolicy('marcaai', regrasTT) || regrasTT;
export const urlScript = u => politica.createScriptURL(u);
export function html(el, conteudo) {
  el.innerHTML = politica.createHTML(conteudo);
  // CSP não permite style="" inline; larguras e alturas dinâmicas entram pelo CSSOM.
  el.querySelectorAll('[data-w]').forEach(n => { n.style.width = Math.max(0, Math.min(100, +n.dataset.w)) + '%'; });
  el.querySelectorAll('[data-h]').forEach(n => { n.style.height = Math.max(0, Math.min(100, +n.dataset.h)) + '%'; });
}

// Avisos curtos, lidos também por leitor de tela (região viva fixa no HTML).
let timerAviso;
export function toast(msg) {
  const t = document.getElementById('aviso');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => { t.hidden = true; }, 3800);
}
export function anunciar(msg) {
  const r = document.getElementById('anuncio');
  r.textContent = '';
  setTimeout(() => { r.textContent = msg; }, 50);
}

// Diálogo nativo: prende o foco, fecha no Esc e devolve o foco ao botão de origem.
export function dialogo(conteudo, aoMontar) {
  const d = document.getElementById('dialogo');
  if (d.open) d.close();
  html(d.querySelector('.folha'), conteudo);
  d.showModal();
  aoMontar && aoMontar(d);
  (d.querySelector('[autofocus]') || d.querySelector('input,button,a'))?.focus();
}
export function fecharDialogo() { const d = document.getElementById('dialogo'); if (d.open) d.close(); }

// Pergunta de confirmação acessível, no lugar do confirm() do navegador.
export function confirmar(titulo, texto, rotuloSim, rotuloNao = 'Voltar') {
  return new Promise(resolve => {
    dialogo(`<h3 id="dlg-titulo">${esc(titulo)}</h3><p class="mudo mb14">${esc(texto)}</p>
      <div class="pilha"><button class="btn btn-freio" data-r="1">${esc(rotuloSim)}</button>
      <button class="btn btn-fantasma btn-sm" data-r="0" autofocus>${esc(rotuloNao)}</button></div>`, d => {
      const fim = v => { d.removeEventListener('close', aoFechar); fecharDialogo(); resolve(v); };
      const aoFechar = () => resolve(false);
      d.addEventListener('close', aoFechar, { once: true });
      d.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => fim(b.dataset.r === '1')));
    });
  });
}

let audio;
export function bipe() {
  try { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([300, 120, 300]); } catch {}
  try {
    audio = audio || new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    [0, 0.22].forEach(t => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'square'; o.frequency.value = 880; g.gain.value = 0.08;
      o.connect(g).connect(audio.destination); o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.15);
    });
  } catch {}
}
