// "Pôr o Marca aí na tela inicial": instala o app como ícone no celular (PWA).
// Android/Chrome/Edge: o navegador oferece a instalação (evento beforeinstallprompt) e o botão abre
// a janela de instalar de verdade. iPhone (Safari): a Apple não deixa site abrir essa janela, então o
// botão mostra o passo a passo do "Adicionar à Tela de Início".
let pedido = null;
const ouvintes = new Set();
const avisar = () => ouvintes.forEach(fn => fn());

addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedido = e; avisar(); });
addEventListener('appinstalled', () => { pedido = null; avisar(); });

export const aoMudarInstalar = fn => { ouvintes.add(fn); return () => ouvintes.delete(fn); };
/** Já está aberto como app instalado (ícone na tela inicial)? Então o botão some. */
export const jaInstalado = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
export const ehIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const podeAbrirJanela = () => !!pedido;

/** Abre a janela de instalar do navegador. Devolve 'aceitou' | 'recusou' | 'manual' (sem janela: mostrar o passo a passo). */
export async function instalar() {
  if (!pedido) return 'manual';
  const p = pedido; pedido = null;
  try {
    await p.prompt();
    const { outcome } = await p.userChoice;
    avisar();
    return outcome === 'accepted' ? 'aceitou' : 'recusou';
  } catch { avisar(); return 'manual'; }
}
