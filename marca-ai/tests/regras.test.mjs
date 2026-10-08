// Rode com: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frete, taxaEspera, ganho, podeIr, saldo, resumoDia, reputacao, novoCodigo, TABELA } from '../js/regras.js';
import { limparChamado, limparEstado, limparPerfil, numero } from '../js/esquema.js';

const min = 60000;

test('frete: mínimo até 3 km, R$2 por km extra, chuva soma R$2', () => {
  assert.equal(frete(1), 8);
  assert.equal(frete(3), 8);
  assert.equal(frete(5), 12);
  assert.equal(frete(5, true), 14);
  assert.equal(frete(-10), 8);
});

test('espera: 10 min grátis, depois R$0,50 por minuto', () => {
  assert.equal(taxaEspera({ chegouEm: 0, coletouEm: 10 * min }), 0);
  assert.equal(taxaEspera({ chegouEm: 0, coletouEm: 15 * min }), 2.5);
  assert.equal(taxaEspera({}), 0);
});

test('ganho soma frete, espera e gorjeta; cancelado paga deslocamento', () => {
  assert.equal(ganho({ status: 'entregue', valor: 12, espera: 2.5, gorjeta: 5 }), 19.5);
  assert.equal(ganho({ status: 'cancelado', compensacao: TABELA.deslocamentoCancelado }), 5);
  assert.equal(ganho({ status: 'coletado', valor: 12 }), 0);
});

test('máquina de estados não deixa pular etapa', () => {
  assert.ok(podeIr('aberto', 'aceito'));
  assert.ok(!podeIr('aberto', 'entregue'));
  assert.ok(!podeIr('coletado', 'cancelado'));
  assert.ok(!podeIr('entregue', 'aceito'));
  assert.ok(!podeIr('__proto__', 'aceito'));
});

test('saldo desconta saques', () => {
  const calls = [{ motoboy: 'João', status: 'entregue', valor: 12, espera: 0, gorjeta: 0 }];
  assert.equal(saldo(calls, [{ valor: 5 }]), 7);
});

test('resumo do dia desconta gasolina', () => {
  const agora = Date.now();
  const calls = [{ motoboy: 'J', status: 'entregue', valor: 12, km: 7, entregueEm: agora, espera: 0, gorjeta: 0 }];
  const r = resumoDia(calls, { consumo: 35, gasolina: 7 }, agora);
  assert.deepEqual(r, { n: 1, bruto: 12, km: 7, comb: 1.4 });
});

test('reputação faz média da nota e da espera', () => {
  const calls = [
    { empresa: 'X', avaliado: true, nota: 5, tags: ['Atendimento bom'], chegouEm: 0, coletouEm: 4 * min },
    { empresa: 'X', avaliado: true, nota: 3, tags: [], chegouEm: 0, coletouEm: 8 * min }
  ];
  const r = reputacao(calls, 'X');
  assert.equal(r.nota, 4); assert.equal(r.espera, 6); assert.equal(r.n, 2);
});

test('código de entrega tem sempre 4 dígitos', () => {
  for (let i = 0; i < 500; i++) assert.match(novoCodigo(), /^\d{4}$/);
});

test('validação recalcula o valor: valor adulterado no armazenamento é ignorado', () => {
  const c = limparChamado({ id: 'a', status: 'aberto', km: 5, valor: 9999, codigo: '1234' });
  assert.equal(c.valor, 12);
});

test('validação descarta status desconhecido e limita tamanhos', () => {
  assert.equal(limparChamado({ id: 'a', status: 'pago' }), null);
  const c = limparChamado({ id: 'a', status: 'aberto', obs: 'x'.repeat(5000), km: 999, codigo: '<b>', gorjeta: 1000, tags: ['inventada', 'Atendimento bom'] });
  assert.equal(c.obs.length, 300);
  assert.equal(c.km, 100);
  assert.equal(c.codigo, '0000');
  assert.equal(c.gorjeta, 0);
  assert.deepEqual(c.tags, ['Atendimento bom']);
});

test('validação aguenta lixo e não herda __proto__', () => {
  const e = limparEstado(JSON.parse('{"__proto__":{"admin":true},"calls":"x","profile":{"consumo":"abc"}}'));
  assert.deepEqual(e.calls, []);
  assert.equal(e.admin, undefined);
  assert.equal(e.profile.consumo, 35);
  assert.deepEqual(limparEstado(null).calls, []);
});

test('perfil: placa normalizada e números em faixa', () => {
  const p = limparPerfil({ placa: 'abc-1d23<script>', gasolina: '6,50', meta: -5 });
  assert.equal(p.placa, 'ABC-1D23SCRIPT'.slice(0, 10));
  assert.equal(p.gasolina, 6.5);
  assert.equal(p.meta, 0);
  assert.equal(numero('', 0, 10, 7), 7);
});

import { ticketMedio, mensagemCliente, resumoMes } from '../js/regras.js';

test('ticket médio usa as entregas feitas, ou o frete mínimo sem histórico', () => {
  assert.equal(ticketMedio([]), 8);
  assert.equal(ticketMedio([{ motoboy: 'J', status: 'entregue', valor: 10, espera: 0, gorjeta: 0 }, { motoboy: 'J', status: 'entregue', valor: 14, espera: 0, gorjeta: 0 }]), 12);
});

test('mensagem pro cliente leva motoboy, placa e código', () => {
  assert.equal(mensagemCliente({ cliente: 'Ana', empresa: 'Padaria', motoboy: 'João', placa: 'ABC1D23', codigo: '1234' }),
    'Oi, Ana! Seu pedido da Padaria está com o motoboy João (placa ABC1D23). Na entrega, informe o código 1234.');
  assert.match(mensagemCliente({ empresa: 'Padaria', codigo: '1234' }), /^Oi! .*aguardando o motoboy/);
});

test('resumo do mês soma taxa e deslocamento e ignora teste e outro mês', () => {
  const agora = new Date(2026, 9, 15).getTime();
  const calls = [
    { empresa: 'P', status: 'entregue', valor: 12, espera: 0, gorjeta: 5, criadoEm: agora, chegouEm: 0, coletouEm: 6 * 60000 },
    { empresa: 'P', status: 'cancelado', compensacao: 5, criadoEm: agora },
    { empresa: 'P', status: 'entregue', valor: 12, espera: 0, gorjeta: 0, criadoEm: agora, teste: true },
    { empresa: 'P', status: 'entregue', valor: 12, espera: 0, gorjeta: 0, criadoEm: new Date(2026, 8, 1).getTime() }
  ];
  assert.deepEqual(resumoMes(calls, 'P', new Date(agora)), { total: 2, entregas: 1, gasto: 23.5, esperaMin: 6 });
});

import { informeMes, faixasHorario } from '../js/regras.js';

test('informe do mês: só corridas pagas do mês, com gasolina e saques', () => {
  const out = new Date(2026, 9, 10, 12).getTime();
  const calls = [
    { motoboy: 'J', status: 'entregue', valor: 12, espera: 2, gorjeta: 0, km: 5, entregueEm: out },
    { motoboy: 'J', status: 'cancelado', compensacao: 5, canceladoEm: out + 1 },
    { motoboy: 'J', status: 'entregue', valor: 8, espera: 0, gorjeta: 0, km: 2, entregueEm: new Date(2026, 8, 30).getTime() },
    { motoboy: '', status: 'aberto', valor: 8, km: 2, criadoEm: out }
  ];
  const r = informeMes(calls, [{ valor: 10, em: out }, { valor: 3, em: new Date(2026, 8, 1).getTime() }], { consumo: 35, gasolina: 7 }, new Date(out));
  assert.equal(r.linhas.length, 2);
  assert.equal(r.corridas, 1);
  assert.equal(r.bruto, 19);
  assert.equal(r.km, 5);
  assert.equal(r.comb, 1);
  assert.equal(r.sacado, 10);
});

test('faixas de horário: soma por faixa, inclusive madrugada que vira o dia', () => {
  const h = hr => new Date(2026, 9, 10, hr, 30).getTime();
  const e = (hr, valor) => ({ motoboy: 'J', status: 'entregue', valor, espera: 0, gorjeta: 0, entregueEm: h(hr) });
  const r = faixasHorario([e(12, 10), e(13, 10), e(19, 15), e(2, 9), { motoboy: 'J', status: 'aceito', valor: 50 }]);
  assert.deepEqual(r.map(f => [f.nome, f.n, f.total]), [['Almoço', 2, 20], ['Noite', 1, 15], ['Madrugada', 1, 9]]);
});
