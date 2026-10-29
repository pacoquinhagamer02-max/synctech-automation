// Melhorias copiadas da estrutura dos concorrentes (16/10/2026): volta à loja, cobrança na entrega,
// tempo/ganho por hora na oferta e link de rastreio pro cliente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frete, trocoLevar, avisoCobranca, estimativaCorrida, tokenRastreio, linkRastreio, mensagemCliente, TOKEN_RASTREIO, MIN_BALCAO } from '../js/regras.js';
import { limparChamado } from '../js/esquema.js';
import { criarCorridas } from '../js/corridas.js';
import { armazemLocal } from '../js/armazens.js';

test('volta à loja paga metade do trajeto de novo; chuva não dobra', () => {
  assert.equal(frete(3, false, true), 12);       // 8 + 4
  assert.equal(frete(5, false, true), 18);       // 12 + 6
  assert.equal(frete(5, true, true), 20);        // 18 + 2 de chuva
  assert.equal(frete(5, true), 14, 'sem volta continua igual');
  assert.equal(frete(4.01, false, true), 15.03); // ida 8 + 1,01×2 = 10,02 → × 1,5
});

test('troco que o motoboy leva e aviso antes do aceite', () => {
  assert.equal(trocoLevar({ cobranca: 'dinheiro', cobrar: 37, troco: 50 }), 13);
  assert.equal(trocoLevar({ cobranca: 'dinheiro', cobrar: 37, troco: 0 }), 0);
  assert.equal(trocoLevar({ cobranca: 'maquininha', cobrar: 37, troco: 50 }), 0);
  assert.equal(avisoCobranca({ cobranca: 'maquininha' }), 'Levar maquininha: o cliente paga na entrega');
  assert.equal(avisoCobranca({ cobranca: 'dinheiro' }), 'Cobrar em dinheiro na entrega');
  assert.equal(avisoCobranca({ cobranca: 'pago' }), '');
});

test('estimativa da corrida: ida até a loja + balcão + entrega (+ volta)', () => {
  const c = { km: 2.2, valor: 8 };
  const e = estimativaCorrida(c, 1.1);
  assert.equal(e.min, 3 + MIN_BALCAO + 6);
  assert.equal(e.porHora, 34.29);
  assert.equal(estimativaCorrida({ ...c, volta: true, valor: 12 }, null).min, MIN_BALCAO + 6 + 6, 'sem GPS não soma a ida');
});

test('token de rastreio: 22 caracteres seguros pra URL, diferente a cada chamado', () => {
  const a = tokenRastreio(), b = tokenRastreio();
  assert.match(a, TOKEN_RASTREIO);
  assert.notEqual(a, b);
  assert.equal(linkRastreio('https://marcaai-app.netlify.app/?demo#x', a), `https://marcaai-app.netlify.app/rastreio.html#${a}`);
  assert.equal(linkRastreio('https://x.github.io/synctech-automation/marca-ai/index.html', a), `https://x.github.io/synctech-automation/marca-ai/rastreio.html#${a}`);
  assert.equal(linkRastreio('https://x.app/', 'curto'), '', 'token inválido não vira link');
});

test('mensagem pro cliente leva cobrança e o link do mapa', () => {
  const m = mensagemCliente({ cliente: 'Ana', empresa: 'Padaria', motoboy: 'João', placa: 'ABC1D23', codigo: '4821', cobranca: 'dinheiro', cobrar: 37, troco: 50 }, 'https://x/rastreio.html#abc');
  assert.match(m, /cobrar R\$\s?37,00 em dinheiro e leva troco pra R\$\s?50,00/);
  assert.match(m, /código 4821/);
  assert.match(m, /Acompanhe no mapa: https:\/\/x\/rastreio\.html#abc/);
});

test('validação: volta recalcula o valor; cobrança inválida vira "pago"; token estranho some', () => {
  const base = { id: 'x', status: 'aberto', km: 5, empresa: 'P', coleta: 'a', entrega: 'b' };
  assert.equal(limparChamado({ ...base, volta: true, valor: 1 }).valor, 18);
  const c = limparChamado({ ...base, cobranca: 'pix-falso', cobrar: 99, rastreio: '<script>' });
  assert.equal(c.cobranca, 'pago'); assert.equal(c.cobrar, 0); assert.equal(c.rastreio, '');
  assert.equal(limparChamado({ ...base, cobranca: 'dinheiro', cobrar: 99999, troco: 50 }).cobrar, 5000);
});

test('chamar cria o chamado com volta, cobrança e token de rastreio', async () => {
  let estado = { calls: [] };
  const corridas = criarCorridas(armazemLocal({ S: () => estado, transacao: fn => { fn(estado); return true; } }));
  const r = await corridas.chamar({ empresa: 'P', coleta: 'a', entrega: 'b', km: 5, volta: true, cobranca: 'dinheiro', cobrar: 37, troco: 50 });
  assert.equal(r.ok, true);
  const c = estado.calls[0];
  assert.equal(c.valor, 18);
  assert.equal(c.cobranca, 'dinheiro'); assert.equal(c.cobrar, 37); assert.equal(c.troco, 50);
  assert.match(c.rastreio, TOKEN_RASTREIO);
});
