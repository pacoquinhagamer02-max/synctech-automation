// GPS do motoboy: liga só quando ele está online, mede o km de verdade da corrida
// e avisa quando chega na loja. A posição fica no aparelho (e, quando existir
// servidor, vai só pra empresa da corrida em andamento).
import { distanciaKm, r2 } from './regras.js';
import { criarFiltroGps } from './rota.js';

let vigia = null;
let ultimo = null;          // último ponto aceito, pra somar o km rodado
let ultimaGravacao = 0;
let filtro = criarFiltroGps(); // tira a tremida do GPS (Kalman), como Uber e Google
let estado = 'desligado';   // desligado | pedindo | ligado | negado | sem-gps
const ouvintes = new Set();

const PRECISAO_MAX_M = 80;  // leitura pior que isso é descartada
const PASSO_MIN_KM = 0.015; // tremida do GPS parado não conta como km
const SALTO_MAX_KM = 1;     // salto absurdo entre leituras (túnel, erro) não conta
const GRAVAR_A_CADA_MS = 10000;

export const estadoGps = () => estado;
export const aoMudarGps = fn => { ouvintes.add(fn); return () => ouvintes.delete(fn); };
const avisar = () => ouvintes.forEach(fn => fn(estado));

/**
 * Liga o acompanhamento. `aoPonto(ponto, kmAndado)` recebe cada leitura boa;
 * `forcar` diz se vale gravar agora (passou o intervalo ou andou).
 */
export function ligarGps(aoPonto) {
  if (vigia != null) return;
  if (!('geolocation' in navigator)) { estado = 'sem-gps'; avisar(); return; }
  estado = 'pedindo'; avisar();
  vigia = navigator.geolocation.watchPosition(p => {
    if (estado !== 'ligado') { estado = 'ligado'; avisar(); }
    const precisao = Math.round(p.coords.accuracy);
    if (precisao > PRECISAO_MAX_M) return;
    const ponto = filtro({ lat: p.coords.latitude, lon: p.coords.longitude, precisao, em: Date.now() });
    let andou = 0;
    if (ultimo) {
      const d = distanciaKm(ultimo, ponto);
      if (d < PASSO_MIN_KM) { if (Date.now() - ultimaGravacao < GRAVAR_A_CADA_MS) return; }
      else if (d <= SALTO_MAX_KM) andou = d;
    }
    if (!ultimo || andou) ultimo = ponto;
    ultimaGravacao = Date.now();
    aoPonto(ponto, r2(andou * 1000) / 1000);
  }, erro => {
    estado = erro.code === 1 ? 'negado' : 'sem-gps';
    desligarGps(true);
    avisar();
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
}

export function desligarGps(manterEstado = false) {
  if (vigia != null) navigator.geolocation.clearWatch(vigia);
  vigia = null; ultimo = null; filtro = criarFiltroGps();
  if (!manterEstado) { estado = 'desligado'; avisar(); }
}

/** Leitura única (empresa marcando onde fica a loja). */
export function pegarPosicao() {
  return new Promise((ok, falha) => {
    if (!('geolocation' in navigator)) { falha(new Error('sem-gps')); return; }
    navigator.geolocation.getCurrentPosition(
      p => ok({ lat: p.coords.latitude, lon: p.coords.longitude, precisao: Math.round(p.coords.accuracy) }),
      e => falha(new Error(e.code === 1 ? 'negado' : 'sem-gps')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}
