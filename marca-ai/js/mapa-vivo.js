// Mapa ao vivo da corrida, no modelo Uber/iFood: rota pelas ruas, ícone da moto
// andando liso entre uma leitura e outra (em cima da rua quando está na rota),
// trecho já rodado some, rota refeita quando o motoboy sai do caminho.
// Desenhado num <canvas> com os blocos do OpenStreetMap: sem biblioteca de terceiros
// e sem innerHTML (o CSP com Trusted Types continua valendo).
//
// Uso: o HTML da tela leva o marcador de mapaVivo(...); depois de cada redesenho,
// montarMapas() recoloca o mesmo canvas no lugar (o estado e a animação continuam).
import { esc } from './ui.js';
import { buscarRota, projetarNaRota, etaRotaMin, deveRecalcular, rumoDe, GRUDA_M, DESVIO_RECALCULA_M } from './rota.js';

const TILE = 256, ZMIN = 11, ZMAX = 17, ALTURA = 230;
const TILES = 'https://tile.openstreetmap.org';
const mapas = new Map();
const ouvintes = new Set();
let laco = 0;

export const aoMudarRota = fn => { ouvintes.add(fn); return () => ouvintes.delete(fn); };

const geoTxt = g => (g ? `${g.lat.toFixed(6)},${g.lon.toFixed(6)}` : '');
const lerGeo = s => { const [lat, lon] = String(s || '').split(',').map(Number); return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null; };

/**
 * Marcador do mapa no HTML. fase: 'oferta' (loja → cliente), 'loja' (indo pra loja),
 * 'naloja' (no balcão) ou 'cliente' (levando). `moto` = posição recente do motoboy ou null.
 */
export function mapaVivo(id, { loja, cliente, moto, fase, rotulo }) {
  return `<div class="mapa-vivo" data-mapa-vivo="${esc(id)}" data-loja="${geoTxt(loja)}" data-cliente="${geoTxt(cliente)}"
    data-moto="${moto ? `${geoTxt(moto)},${moto.em || 0}` : ''}" data-fase="${esc(fase)}" data-rotulo="${esc(rotulo || 'Mapa da corrida')}"></div>
    <p class="mapa-legenda">Mapa © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">colaboradores do OpenStreetMap</a>. Rota pelas ruas: OSRM.</p>`;
}

/** Distância e tempo que faltam pela rota (null enquanto a rota não chegou). */
export function infoRota(id) {
  const m = mapas.get(id);
  if (!m?.rota) return null;
  if (m.origemMoto && m.moto) {
    const p = projetarNaRota(m.rota.pontos, m.moto.para);
    if (!p) return null;
    const restanteKm = p.restanteKm + p.desvioM / 1000;
    return { km: restanteKm, min: etaRotaMin(m.rota, restanteKm), foraDaRota: p.desvioM > GRUDA_M };
  }
  return { km: m.rota.km, min: Math.max(1, Math.round(m.rota.min)), foraDaRota: false };
}

/** Recoloca cada mapa no seu marcador e atualiza os dados (chamar depois de redesenhar a tela). */
export function montarMapas() {
  document.querySelectorAll('[data-mapa-vivo]').forEach(el => {
    const id = el.dataset.mapaVivo;
    let m = mapas.get(id);
    if (!m) { m = criar(); mapas.set(id, m); }
    el.replaceChildren(m.canvas);
    m.canvas.setAttribute('aria-label', el.dataset.rotulo);
    atualizar(m, {
      loja: lerGeo(el.dataset.loja), cliente: lerGeo(el.dataset.cliente), fase: el.dataset.fase,
      moto: (() => { const g = lerGeo(el.dataset.moto); return g ? { ...g, em: +el.dataset.moto.split(',')[2] || 0 } : null; })()
    });
  });
  // Mapa de corrida que já acabou sai da memória.
  for (const [id, m] of mapas) if (!m.canvas.isConnected && Date.now() - m.vistoEm > 120000) mapas.delete(id);
  if (!laco) laco = requestAnimationFrame(quadro);
}

function criar() {
  const canvas = document.createElement('canvas');
  canvas.className = 'mapa-canvas';
  canvas.setAttribute('role', 'img');
  return { canvas, ctx: canvas.getContext('2d'), cam: null, rota: null, chaveRota: '', pedindo: false, ultimoPedido: 0, foraSeguidas: 0,
    moto: null, rumo: 0, rumoMostrado: 0, sujo: true, vistoEm: Date.now() };
}

function atualizar(m, d) {
  m.vistoEm = Date.now();
  m.fase = d.fase; m.loja = d.loja; m.cliente = d.cliente;
  const naRua = ['loja', 'cliente'].includes(d.fase) && d.moto;
  // Na rua com GPS: da moto até onde ela vai. Sem isso (oferta, balcão, sem GPS): da loja até o cliente.
  const destino = naRua && d.fase === 'loja' ? d.loja : d.cliente;
  const origem = naRua ? d.moto : d.loja;
  m.destino = destino;
  m.origemMoto = !!naRua;

  // Moto: anima do ponto mostrado até a leitura nova, no tempo entre as leituras (fica sempre andando, como no Uber).
  if (d.moto && d.fase !== 'oferta') {
    if (!m.moto) m.moto = { de: d.moto, para: d.moto, t0: 0, dur: 1, em: d.moto.em };
    else if (d.moto.em !== m.moto.em) {
      let alvo = d.moto;
      const p = m.rota && projetarNaRota(m.rota.pontos, d.moto);
      if (p && p.desvioM <= GRUDA_M) alvo = p.ponto;  // em cima da rua
      const de = posMoto(m, performance.now());
      const dur = Math.min(10000, Math.max(800, d.moto.em - m.moto.em));
      if (Math.hypot((alvo.lat - de.lat) * 111320, (alvo.lon - de.lon) * 111320 * Math.cos(de.lat * Math.PI / 180)) > 3) m.rumo = rumoDe(de, alvo);
      m.moto = { de, para: alvo, t0: performance.now(), dur, em: d.moto.em };
    }
  } else m.moto = null;
  m.sujo = true;

  if (!origem || !destino) return;
  const chave = `${naRua ? 'moto' : 'loja'}|${geoTxt(destino)}`;
  const agora = Date.now();
  let pedir = chave !== m.chaveRota && !m.pedindo;
  if (!pedir && m.rota && naRua) {
    const p = projetarNaRota(m.rota.pontos, d.moto);
    m.foraSeguidas = p && p.desvioM > DESVIO_RECALCULA_M ? m.foraSeguidas + 1 : 0;
    pedir = !m.pedindo && deveRecalcular({ desvioM: p?.desvioM ?? 0, foraSeguidas: m.foraSeguidas, ultimoPedido: m.ultimoPedido, agora });
  }
  if (!pedir) return;
  if (chave !== m.chaveRota) m.rota = null; // rota de outra etapa não vale mais (recálculo mantém a antiga até chegar a nova)
  m.chaveRota = chave; m.pedindo = true; m.ultimoPedido = agora; m.foraSeguidas = 0;
  buscarRota(origem, destino).then(r => {
    m.pedindo = false;
    if (!r || m.chaveRota !== chave) return;
    m.rota = r; m.sujo = true;
    ouvintes.forEach(fn => fn());
  });
}

function posMoto(m, t) {
  if (!m.moto) return null;
  const k = Math.min(1, (t - m.moto.t0) / m.moto.dur);
  return { lat: m.moto.de.lat + (m.moto.para.lat - m.moto.de.lat) * k, lon: m.moto.de.lon + (m.moto.para.lon - m.moto.de.lon) * k };
}

/* ---------- projeção Web Mercator (a mesma dos blocos do OSM) ---------- */
const mundo = (g, z) => {
  const n = TILE * 2 ** z, s = Math.sin(g.lat * Math.PI / 180);
  return { x: (g.lon + 180) / 360 * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
};

// Câmera: enquadra moto, destino e o resto dos pontos, com folga; zoom fracionado pra transição lisa.
function enquadrar(m, w, h, moto) {
  const pts = [moto, m.destino, m.fase === 'oferta' || m.fase === 'naloja' ? m.loja : null, m.fase === 'loja' ? null : m.cliente].filter(Boolean);
  if (!moto && m.rota && m.fase === 'oferta') pts.push(...m.rota.pontos.filter((_, i) => i % 10 === 0));
  if (!pts.length) return null;
  const a = pts.map(p => mundo(p, 0));
  const xs = a.map(p => p.x), ys = a.map(p => p.y);
  const lx = Math.max(...xs) - Math.min(...xs), ly = Math.max(...ys) - Math.min(...ys);
  const folga = 56;
  let z = Math.log2(Math.min((w - folga * 2) / Math.max(lx, 1e-9), (h - folga * 2) / Math.max(ly, 1e-9)));
  z = Math.max(ZMIN, Math.min(ZMAX - 0.5, z));
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, z };
}

const imagens = new Map();
function bloco(z, x, y, m) {
  const n = 2 ** z; if (y < 0 || y >= n) return null;
  x = ((x % n) + n) % n;
  const chave = `${z}/${x}/${y}`;
  let img = imagens.get(chave);
  if (!img) {
    img = new Image();
    // O OSM pede a origem do site (política de uso dos blocos); o resto do app não manda referrer.
    img.referrerPolicy = 'strict-origin';
    img.decoding = 'async';
    img.onload = () => { m.sujo = true; };
    img.src = `${TILES}/${chave}.png`;
    if (imagens.size > 300) imagens.delete(imagens.keys().next().value);
    imagens.set(chave, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

function quadro(t) {
  laco = 0;
  let algum = false;
  for (const m of mapas.values()) {
    if (!m.canvas.isConnected) continue;
    algum = true;
    desenhar(m, t);
  }
  if (algum) laco = requestAnimationFrame(quadro);
}

function desenhar(m, t) {
  const c = m.canvas, dpr = Math.min(2, devicePixelRatio || 1);
  const w = c.clientWidth || 320, h = ALTURA;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); m.sujo = true; }
  const moto = posMoto(m, t);
  const andando = m.moto && t - m.moto.t0 < m.moto.dur;
  const alvo = enquadrar(m, w, h, moto);
  if (!alvo) return;
  if (!m.cam) m.cam = { ...alvo };
  const mov = Math.abs(m.cam.x - alvo.x) * 2 ** m.cam.z + Math.abs(m.cam.y - alvo.y) * 2 ** m.cam.z + Math.abs(m.cam.z - alvo.z) * 100;
  const virando = Math.abs(((m.rumo - m.rumoMostrado + 540) % 360) - 180) > 0.5;
  if (!m.sujo && !andando && mov < 0.5 && !virando) return;
  m.sujo = false;
  m.cam.x += (alvo.x - m.cam.x) * 0.12; m.cam.y += (alvo.y - m.cam.y) * 0.12; m.cam.z += (alvo.z - m.cam.z) * 0.12;
  m.rumoMostrado += ((((m.rumo - m.rumoMostrado) % 360) + 540) % 360 - 180) * 0.15;

  const ctx = m.ctx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const escuro = document.documentElement.dataset.tema !== 'sol';
  ctx.fillStyle = escuro ? '#0A0A0A' : '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  // Blocos do mapa no zoom inteiro mais perto, esticados pro zoom fracionado da câmera.
  const tz = Math.min(ZMAX, Math.round(m.cam.z)), esc2 = 2 ** (m.cam.z - tz), lado = TILE * esc2;
  const cx = m.cam.x * 2 ** tz, cy = m.cam.y * 2 ** tz;             // centro em pixels do zoom tz
  const ox = w / 2 - cx * esc2, oy = h / 2 - cy * esc2;
  const x0 = Math.floor((-ox) / lado), y0 = Math.floor((-oy) / lado);
  const x1 = Math.floor((w - ox) / lado), y1 = Math.floor((h - oy) / lado);
  ctx.save();
  // Mapa preto e branco nos dois temas: a rota amarela salta.
  ctx.filter = escuro ? 'invert(1) grayscale(1) brightness(.8) contrast(1.25)' : 'grayscale(1) contrast(1.1)';
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const img = bloco(tz, x, y, m);
    if (img) ctx.drawImage(img, Math.round(ox + x * lado), Math.round(oy + y * lado), Math.ceil(lado) + 1, Math.ceil(lado) + 1);
  }
  ctx.restore();

  const tela = g => { const p = mundo(g, m.cam.z); return { x: w / 2 + (p.x - m.cam.x * 2 ** m.cam.z), y: h / 2 + (p.y - m.cam.y * 2 ** m.cam.z) }; };

  // Rota: só o que falta (o trecho rodado some), contorno escuro + amarelo de placa.
  if (m.rota) {
    let pts = m.rota.pontos, inicio = null;
    if (moto && m.origemMoto) {
      const p = projetarNaRota(pts, moto);
      if (p) { pts = pts.slice(p.indice + 1); inicio = p.desvioM <= GRUDA_M ? p.ponto : moto; }
    }
    const linha = (inicio ? [inicio, ...pts] : pts).map(tela);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [cor, larg] of [['#15171A', 9], ['#FFC21A', 5]]) {
      ctx.beginPath(); linha.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.strokeStyle = cor; ctx.lineWidth = larg; ctx.stroke();
    }
  } else if (moto && m.destino && m.origemMoto) {
    // Sem rota (sem internet): linha tracejada reta até o destino.
    const a = tela(moto), b = tela(m.destino);
    ctx.setLineDash([6, 8]); ctx.strokeStyle = '#FFC21A'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
  }

  if (m.loja && m.fase !== 'cliente') pino(ctx, tela(m.loja), 'loja');
  if (m.cliente && m.fase !== 'loja') pino(ctx, tela(m.cliente), 'cliente');
  if (moto) motoIcone(ctx, tela(moto), m.rumoMostrado, t);

  ctx.font = '600 10px system-ui, sans-serif';
  const credito = '© OpenStreetMap';
  const lw = ctx.measureText(credito).width + 10;
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(w - lw, h - 16, lw, 16);
  ctx.fillStyle = '#333'; ctx.fillText(credito, w - lw + 5, h - 4);
}

function pino(ctx, p, tipo) {
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  if (tipo === 'loja') {
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fillStyle = '#FFC21A'; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.lineWidth = 3; ctx.strokeStyle = '#231A00'; ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.rect(-6, -1, 12, 7); ctx.moveTo(-7, -1); ctx.lineTo(-5, -6); ctx.lineTo(5, -6); ctx.lineTo(7, -1); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.roundRect(-12, -12, 24, 24, 5); ctx.fillStyle = '#F5F3EA'; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.lineWidth = 3; ctx.strokeStyle = '#15171A'; ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, 6); ctx.lineTo(-5, -6); ctx.lineTo(4, -6); ctx.lineTo(2, -3); ctx.lineTo(4, 0); ctx.lineTo(-5, 0); ctx.stroke();
  }
  ctx.restore();
}

function motoIcone(ctx, p, rumo, t) {
  ctx.save(); ctx.translate(p.x, p.y);
  const pulso = (t % 1600) / 1600;
  ctx.beginPath(); ctx.arc(0, 0, 12 + pulso * 14, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(47,191,113,${0.35 * (1 - pulso)})`; ctx.fill();
  ctx.rotate(rumo * Math.PI / 180);
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fillStyle = '#2FBF71'; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.lineWidth = 3; ctx.strokeStyle = '#F5F3EA'; ctx.stroke();
  // Seta pra onde a moto está indo.
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 4); ctx.lineTo(0, 1.5); ctx.lineTo(-5, 4); ctx.closePath();
  ctx.fillStyle = '#F5F3EA'; ctx.fill();
  ctx.restore();
}
