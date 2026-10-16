// Efeitos 3D: peças com [data-3d] inclinam com o dedo/mouse e, no Android, com o
// giroscópio, e um reflexo de luz corre por cima (como uma placa de metal no sol).
// Só mexe em variáveis CSS (--rx, --ry, --gx, --gy) pelo CSSOM: nada de style="" inline,
// então o CSP continua igual. Com "reduzir movimento" ligado no aparelho, não faz nada.

const reduzir = matchMedia('(prefers-reduced-motion: reduce)');
const MAX = 12; // graus
let quadro = 0;

function aplicar(el, nx, ny) {
  // nx, ny de -1 a 1 (centro = 0)
  const m = +(el.dataset['3d'] || MAX) || MAX;
  el.style.setProperty('--rx', `${(-ny * m).toFixed(2)}deg`);
  el.style.setProperty('--ry', `${(nx * m).toFixed(2)}deg`);
  el.style.setProperty('--gx', `${((nx + 1) * 50).toFixed(1)}%`);
  el.style.setProperty('--gy', `${((ny + 1) * 50).toFixed(1)}%`);
}
function soltar(el) {
  el.classList.remove('mexendo');
  ['--rx', '--ry', '--gx', '--gy'].forEach(v => el.style.removeProperty(v));
}

function aoMover(e) {
  if (reduzir.matches) return;
  const el = e.target.closest?.('[data-3d]');
  if (!el) return;
  cancelAnimationFrame(quadro);
  quadro = requestAnimationFrame(() => {
    const r = el.getBoundingClientRect();
    const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    el.classList.add('mexendo');
    aplicar(el, nx, ny);
  });
}
function aoSair(e) {
  const el = e.target.closest?.('[data-3d]');
  if (el && !el.contains(e.relatedTarget)) soltar(el);
}

// Giroscópio (Android e navegadores que não pedem permissão). No iPhone o toque já faz o efeito.
let base = null;
function aoInclinarCelular(e) {
  if (reduzir.matches || e.beta == null || e.gamma == null) return;
  if (!base) base = { beta: e.beta, gamma: e.gamma };
  const nx = Math.max(-1, Math.min(1, (e.gamma - base.gamma) / 25));
  const ny = Math.max(-1, Math.min(1, (e.beta - base.beta) / 25));
  cancelAnimationFrame(quadro);
  quadro = requestAnimationFrame(() => {
    document.querySelectorAll('[data-3d][data-giro]').forEach(el => {
      if (el.classList.contains('mexendo')) return; // o dedo manda mais que o giroscópio
      aplicar(el, nx, ny);
    });
  });
}

// Entrada em cascata: só quando a tela muda de verdade (não a cada leitura do GPS).
export function marcarEntrada(el, conteudo) {
  const tela = /data-tela="([^"]*)"/.exec(conteudo)?.[1];
  if (!tela || el.dataset.telaAtual === tela) return;
  el.dataset.telaAtual = tela;
  if (reduzir.matches) return;
  el.classList.remove('entra');
  void el.offsetWidth; // reinicia a animação
  el.classList.add('entra');
  clearTimeout(el._entra);
  el._entra = setTimeout(() => el.classList.remove('entra'), 1400);
}

export function ligarEfeitos() {
  document.addEventListener('pointermove', aoMover, { passive: true });
  document.addEventListener('pointerout', aoSair, { passive: true });
  document.addEventListener('pointercancel', e => { const el = e.target.closest?.('[data-3d]'); if (el) soltar(el); }, { passive: true });
  if ('DeviceOrientationEvent' in globalThis && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    addEventListener('deviceorientation', aoInclinarCelular, { passive: true });
  }
  // Volta a calibrar o "reto" quando o app volta pra frente.
  document.addEventListener('visibilitychange', () => { base = null; });
}
