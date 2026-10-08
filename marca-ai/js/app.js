// Telas e ações do Marca aí.
import { TABELA, LIMITES, ATIVOS, TAGS_BOAS, TAGS_RUINS, podeIr, frete, taxaEspera, ganho, quandoGanhou, mesmoDia,
  custoKm, resumoDia, saldo, reputacao, novoCodigo, novoId, r2, ticketMedio, mensagemCliente, resumoMes, informeMes, faixasHorario } from './regras.js';
import { limparPerfil, limparEmpresa, texto, numero } from './esquema.js';
import { S, transacao, aoMudar, sessao } from './store.js';
import { esc, brl, km, mmss, hora, dia, ic, fone, mapsUrl, wazeUrl, html, toast, anunciar, dialogo, fecharDialogo, confirmar, bipe, urlScript } from './ui.js';

const $ = s => document.querySelector(s);

/* ============ Escrita segura ============ */
function mudar(fn) {
  try { return transacao(fn); } catch {
    toast('A memória do aparelho encheu. Apague dados antigos do navegador e tente de novo.');
    return false;
  }
}

/* ============ Consultas ============ */
const corridaAtiva = () => S().calls.find(c => c.motoboy && ATIVOS.includes(c.status));
const aAvaliar = () => S().calls.find(c => c.motoboy && c.status === 'entregue' && !c.avaliado);
// Chamados abertos que o motoboy ainda não recusou, do mais antigo pro mais novo.
// Como no "Rotas disponíveis" do iFood, ele pode escolher qual quer ver primeiro.
let escolhida = null;
const ofertasAbertas = () => S().calls.filter(c => c.status === 'aberto' && !S().recusados.includes(c.id)).sort((a, b) => a.criadoEm - b.criadoEm);
const ofertaAtual = () => { const l = ofertasAbertas(); return l.find(c => c.id === escolhida) || l[0]; };

// Mapa ilustrativo (SVG gerado pelo id do chamado, sem serviço externo).
// A rota de verdade abre no Google Maps ou no Waze.
function mapa(c, fase) {
  let h = 0;
  for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return h / 4294967296; };
  const W = 340, H = 150;
  const vs = [0, 1, 2, 3, 4, 5, 6, 7].map(i => Math.round(20 + i * 44 + rnd() * 10));
  const hs = [0, 1, 2, 3].map(i => Math.round(18 + i * 38 + rnd() * 8));
  const loja = { x: vs[1], y: hs[2] }, cli = { x: vs[5 + Math.floor(rnd() * 2)], y: hs[Math.floor(rnd() * 2)] };
  const meioX = vs[3];
  const rota = `M${loja.x} ${loja.y}H${meioX}V${cli.y}H${cli.x}`;
  const moto = fase === 'loja' ? { x: vs[0], y: hs[3] } : fase === 'cliente' ? { x: meioX, y: Math.round((loja.y + cli.y) / 2) } : null;
  const ruas = vs.map(x => `M${x} 0V${H}`).join('') + hs.map(y => `M0 ${y}H${W}`).join('');
  const quadras = [0, 1, 2].map(() => { const i = Math.floor(rnd() * 6), j = Math.floor(rnd() * 3); return `<rect x="${vs[i] + 7}" y="${hs[j] + 7}" width="${vs[i + 1] - vs[i] - 14}" height="${hs[j + 1] - hs[j] - 14}" rx="4" fill="#2E3B33"/>`; }).join('');
  return `<svg class="mapa" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa ilustrativo: da loja até o cliente, ${km(c.km)} quilômetros">
    <rect width="${W}" height="${H}" fill="#2C2F33"/>${quadras}
    <path d="${ruas}" stroke="#3D4248" stroke-width="9" fill="none"/>
    <path d="${ruas}" stroke="#474C53" stroke-width="1" stroke-dasharray="4 6" fill="none"/>
    <path d="${rota}" stroke="#B98A00" stroke-width="8" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${rota}" class="rota-anim" stroke="#FFC21A" stroke-width="5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
    ${moto ? `<path d="M${moto.x} ${moto.y}H${fase === 'loja' ? loja.x : cli.x}" stroke="#F5F3EA" stroke-width="2" stroke-dasharray="3 5" opacity=".6"/>` : ''}
    <g transform="translate(${loja.x} ${loja.y})"><circle r="13" fill="#FFC21A" stroke="#231A00" stroke-width="3"/><path d="M-6 -1h12v7h-12zM-7 -1l2-5h10l2 5" fill="none" stroke="#231A00" stroke-width="2" stroke-linejoin="round"/></g>
    <g transform="translate(${cli.x} ${cli.y})"><rect x="-12" y="-12" width="24" height="24" rx="5" fill="#F5F3EA" stroke="#15171A" stroke-width="3"/><path d="M-5 5V-6M-5 -6h9l-2 3 2 3h-9" fill="none" stroke="#15171A" stroke-width="2" stroke-linejoin="round"/></g>
    ${moto ? `<g transform="translate(${moto.x} ${moto.y})"><circle r="15" fill="#2FBF71" opacity=".25"/><circle r="9" fill="#2FBF71" stroke="#F5F3EA" stroke-width="3"/></g>` : ''}
  </svg><p class="mapa-legenda">Mapa ilustrativo. A rota de verdade abre no Google Maps ou no Waze.</p>`;
}
const emPausa = () => S().pausaAte && S().pausaAte > Date.now();
const meusGanhos = () => S().calls.filter(c => c.motoboy && ganho(c) > 0);

function linkCliente(c) {
  return `https://wa.me/${fone(c.telCliente)}?text=${encodeURIComponent(mensagemCliente(c))}`;
}

// Resumo do mês da empresa: o que ela gastou e como os motoboys a veem.
function resumoMesEmpresa(nome) {
  const m = resumoMes(S().calls, nome);
  if (!m.total) return '';
  const r = reputacao(S().calls, nome);
  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long' });
  return `<section class="bloco"><h2>Resumo de ${mes}</h2><div class="grade2">
    <div class="mini"><b>${m.entregas}</b><small>${m.entregas === 1 ? 'entrega feita' : 'entregas feitas'}</small></div>
    <div class="mini"><b>${brl(m.gasto)}</b><small>gasto com entregas</small></div>
    <div class="mini"><b>${m.esperaMin != null ? m.esperaMin + ' min' : '–'}</b><small>espera média do motoboy</small></div>
    <div class="mini"><b>${r ? '★ ' + r.nota.toFixed(1).replace('.', ',') : '–'}</b><small>sua nota com os motoboys</small></div>
  </div></section>`;
}

/* ============ Navegação ============ */
const ABAS = {
  moto: [['corridas', 'Corridas', 'moto'], ['ganhos', 'Ganhos', 'carteira'], ['apoio', 'Apoio', 'escudo'], ['perfil', 'Perfil', 'perfil']],
  empresa: [['novo', 'Chamar', 'mais'], ['chamados', 'Chamados', 'lista'], ['loja', 'Empresa', 'loja']]
};
const TITULOS = { corridas: 'Corridas', ganhos: 'Seus ganhos', apoio: 'Apoio e segurança', perfil: 'Seu perfil', novo: 'Chamar motoboy', chamados: 'Seus chamados', loja: 'Dados da empresa' };
// Modo sol: preferência deste aparelho (só conveniência, não é dado do app).
let tema = (() => { try { return localStorage.getItem('marcaai:tema') === 'sol' ? 'sol' : 'noite'; } catch { return 'noite'; } })();
function aplicarTema() {
  document.documentElement.dataset.tema = tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'sol' ? '#F3F1E9' : '#26282B');
}
aplicarTema();

// Rascunho pra "Chamar de novo": preenche o formulário uma vez e some.
let rascunho = null;

let papel = sessao.get('papel', ['moto', 'empresa']);
let aba = papel ? sessao.get('aba', ABAS[papel].map(a => a[0])) || ABAS[papel][0][0] : null;

function entrar(p) {
  papel = p; sessao.set('papel', p);
  aba = ABAS[p][0][0]; sessao.set('aba', aba);
  montar();
}
function irAba(a) {
  if (!ABAS[papel].some(x => x[0] === a)) return;
  aba = a; sessao.set('aba', a); montar(); scrollTo(0, 0);
  $('#view h1')?.focus();
}

function montar() {
  const app = $('#app');
  if (!papel) { html(app, telaBoasVindas()); return; }
  const quem = papel === 'moto' ? (S().profile.nome || 'Motoboy') : (S().empresa.nome || 'Empresa');
  html(app, `
    <a class="pular" href="#view">Pular pro conteúdo</a>
    <header class="top">
      <div class="logo" translate="no">${ic('pin', 'class="pin"')}Marca aí</div>
      <div class="acoes-topo">
        <div class="quem">${esc(quem)}<br><button class="link pq" data-act="trocar">Trocar perfil</button></div>
        <button class="tema" data-act="tema" aria-pressed="${tema === 'sol'}" aria-label="Modo sol: tela clara pra ler no sol">${ic('sol')}</button>
      </div>
    </header>
    <main id="view"><h1 class="vh" tabindex="-1">${TITULOS[aba]}</h1>${VIEWS[papel][aba]()}</main>
    <nav class="tabs" aria-label="Seções">${ABAS[papel].map(([id, nome, i]) =>
      `<button data-act="aba" data-aba="${id}" ${id === aba ? 'aria-current="page"' : ''}>${ic(i)}${nome}<span data-badge="${id}"></span></button>`).join('')}</nav>`);
  refresh();
}

/* ============ Boas-vindas ============ */
function telaBoasVindas() {
  const p = t => `<li>${ic('check')}<span>${t}</span></li>`;
  return `<main class="welcome">
    <div class="logo">${ic('pin', 'class="pin"')}</div>
    <h1 class="marca" translate="no">Marca<br><em>aí</em></h1>
    <p class="lead">O app de entrega que trabalha pro motoboy.</p>
    <figure class="vitrine" aria-label="Exemplo de chamado: R$ 12,00 por 5 km">
      <div class="placa" aria-hidden="true">
        <div class="faixa-azul"><span>Novo chamado</span><span>5 km</span></div>
        <div class="valor num">${brl(frete(5))}</div>
        <div class="porkm">Você vê o valor antes de aceitar</div>
      </div>
    </figure>
    <div class="escolha">
      <button class="btn btn-sinal" data-act="entrar" data-papel="moto">${ic('moto', 'width="26" height="26"')}Sou motoboy</button>
      <button class="btn btn-fantasma" data-act="entrar" data-papel="empresa">${ic('loja', 'width="24" height="24"')}Sou empresa, quero chamar motoboy</button>
    </div>
    <div class="faixas" aria-hidden="true"></div>
    <ul class="promessas">
      ${p('O valor da corrida aparece antes de você aceitar, com o R$ por km.')}
      ${p('100% do frete é seu. A empresa paga a taxa do app, não você.')}
      ${p('Recusou? Sem punição, sem bloqueio, sem perder prioridade.')}
      ${p(`Ficou esperando no balcão mais de ${TABELA.esperaGratisMin} min? A espera é paga.`)}
      ${p('Saque via Pix na hora, sem taxa.')}
    </ul>
    <p class="demo">Versão de demonstração: os dados ficam neste aparelho. Abra o app em duas abas, uma como empresa e outra como motoboy, e veja o chamado chegar ao vivo.</p>
  </main>`;
}

/* ============ Views (estrutura fixa; partes vivas em data-live) ============ */
const campo = (nome, rot, valor, tipo = 'text', extra = '') =>
  `<label class="campo"><span>${rot}</span><input class="inp" name="${nome}" type="${tipo}" value="${esc(valor)}" ${extra}></label>`;

function formEmpresa(titulo, texto, rotulo) {
  return `<form class="bloco" data-form="empresa" novalidate>
    <h2>${titulo}</h2>${texto ? `<p class="sub mb14">${texto}</p>` : ''}
    ${campo('nome', 'Nome da empresa', S().empresa.nome, 'text', `maxlength="${LIMITES.nome}" required autocomplete="organization"`)}
    ${campo('endereco', 'Endereço de retirada', S().empresa.endereco, 'text', `maxlength="${LIMITES.endereco}" autocomplete="street-address"`)}
    ${campo('tel', 'Telefone (o motoboy liga se precisar)', S().empresa.tel, 'tel', `inputmode="tel" maxlength="${LIMITES.tel}" autocomplete="tel"`)}
    <p class="erro" data-erro role="alert"></p>
    <button class="btn btn-sinal" type="submit">${rotulo}</button>
  </form>`;
}

const VIEWS = {
  moto: {
    corridas: () => `<div data-live="mb-status"></div><div data-live="mb-meta"></div><div data-live="mb-main"></div>`,
    ganhos: () => `<div data-live="mb-ganhos"></div>`,
    apoio: () => `
      <button class="sos" data-act="sos">${ic('alerta')}<span><b>SOS</b>Emergência, acidente ou assalto. Liga pra polícia, SAMU ou manda sua localização pro seu contato.</span></button>
      <div data-live="mb-apoio"></div>
      <section class="bloco"><h2>Seus direitos no Marca aí</h2>
        <ul class="direitos">
          <li>${ic('check')}<span>Você vê empresa, distância e valor antes de aceitar.</span></li>
          <li>${ic('check')}<span>Recusar ou deixar passar não gera punição nem bloqueio.</span></li>
          <li>${ic('check')}<span>Espera no balcão acima de ${TABELA.esperaGratisMin} min vale ${brl(TABELA.esperaPorMin)} por minuto, somado automático.</span></li>
          <li>${ic('check')}<span>Empresa cancelou depois que você aceitou? Você recebe ${brl(TABELA.deslocamentoCancelado)} pelo deslocamento.</span></li>
          <li>${ic('check')}<span>Chuva: +${brl(TABELA.chuva)} por corrida.</span></li>
          <li>${ic('check')}<span>Você avalia a empresa. Os outros motoboys veem a nota antes de aceitar.</span></li>
        </ul>
      </section>`,
    perfil: () => {
      const p = S().profile;
      return `<form class="bloco" data-form="perfil" novalidate>
        <h2>Seus dados</h2>
        ${campo('nome', 'Seu nome', p.nome, 'text', `autocomplete="name" maxlength="${LIMITES.nome}" required`)}
        <div class="grade2">${campo('moto', 'Moto', p.moto, 'text', 'placeholder="Ex.: CG 160" maxlength="40"')}${campo('placa', 'Placa', p.placa, 'text', `placeholder="ABC1D23" spellcheck="false" autocomplete="off" maxlength="${LIMITES.placa}" autocapitalize="characters"`)}</div>
        ${campo('pix', 'Chave Pix pra receber', p.pix, 'text', `maxlength="${LIMITES.pix}" autocomplete="off" spellcheck="false"`)}
        <h2 class="mt8">Pra calcular seu lucro de verdade</h2>
        <div class="grade2">${campo('consumo', 'Sua moto faz (km/l)', p.consumo, 'number', 'step="0.1" min="5" max="120" inputmode="decimal"')}${campo('gasolina', 'Gasolina (R$/l)', p.gasolina, 'number', 'step="0.01" min="0.5" max="30" inputmode="decimal"')}</div>
        ${campo('meta', 'Meta do dia (R$)', p.meta, 'number', 'step="5" min="0" max="5000" inputmode="numeric"')}
        ${campo('oleoCada', 'Troca de óleo a cada (km)', p.oleoCada, 'number', 'step="100" min="100" max="20000" inputmode="numeric"')}
        <h2 class="mt8">Segurança</h2>
        ${campo('contato', 'WhatsApp de um contato de emergência', p.contato, 'tel', `placeholder="(31) 99999-9999" inputmode="tel" maxlength="${LIMITES.tel}" autocomplete="off"`)}
        <p class="erro" data-erro role="alert"></p>
        <button class="btn btn-sinal" type="submit">Salvar dados</button>
      </form>`;
    }
  },
  empresa: {
    novo: () => {
      // Primeiro uso: a empresa se cadastra aqui mesmo, sem ser mandada pra outra aba.
      if (!S().empresa.nome) return formEmpresa('Comece pelos dados da sua empresa', 'Leva 30 segundos. O motoboy vê o nome e o endereço de retirada antes de aceitar.', 'Salvar e chamar motoboy');
      const rs = rascunho || {}; rascunho = null;
      const recentes = [...new Set(S().calls.filter(c => c.empresa === S().empresa.nome && !c.teste).sort((x, y) => y.criadoEm - x.criadoEm).map(c => c.entrega))].slice(0, 8);
      return `<form class="bloco" data-form="chamado" novalidate>
        <h2>Chamar motoboy</h2>
        ${campo('coleta', 'Retirada', S().empresa.endereco, 'text', `placeholder="Endereço da sua loja…" maxlength="${LIMITES.endereco}" required autocomplete="off"`)}
        ${campo('entrega', 'Entrega', rs.entrega || '', 'text', `placeholder="Rua, número, bairro…" maxlength="${LIMITES.endereco}" required list="enderecos" autocomplete="off"`)}
        <datalist id="enderecos">${recentes.map(e => `<option value="${esc(e)}"></option>`).join('')}</datalist>
        <div class="campo"><span id="km-rot">Distância da loja até o cliente (km)</span>
          <div class="passo-km">
            <button type="button" class="btn btn-fantasma btn-sm" data-act="km" data-d="-0.5" aria-label="Diminuir meio quilômetro">−</button>
            <input class="inp num" name="km" type="number" value="${rs.km ?? 3}" step="0.1" min="${LIMITES.kmMin}" max="${LIMITES.kmMax}" inputmode="decimal" required aria-labelledby="km-rot">
            <button type="button" class="btn btn-fantasma btn-sm" data-act="km" data-d="0.5" aria-label="Aumentar meio quilômetro">+</button>
          </div>
        </div>
        <div class="grade2">
          ${campo('cliente', 'Cliente', rs.cliente || '', 'text', `placeholder="Ex.: Ana" maxlength="${LIMITES.nome}" autocomplete="off"`)}
          ${campo('telCliente', 'WhatsApp do cliente', rs.telCliente || '', 'tel', `placeholder="(31) 9…" inputmode="tel" maxlength="${LIMITES.tel}" autocomplete="off"`)}
        </div>
        <label class="campo"><span>Observação pro motoboy</span><textarea class="inp" name="obs" maxlength="${LIMITES.obs}" placeholder="Ex.: pedido grande, levar bag térmica, troco pra R$ 50…">${esc(rs.obs || '')}</textarea></label>
        <label class="check"><input type="checkbox" name="chuva"> Está chovendo (+${brl(TABELA.chuva)} pro motoboy)</label>
        <div data-live="em-preco"></div>
        <p class="erro" data-erro role="alert"></p>
        <button class="btn btn-sinal" type="submit" data-cta>Chamar motoboy</button>
      </form>
      <div data-live="em-rep"></div>`;
    },
    chamados: () => `<div data-live="em-lista"></div>`,
    loja: () => `${formEmpresa('Dados da empresa', '', 'Salvar dados')}
      <section class="bloco"><h2>Como funciona o preço</h2>
        <div class="linha"><span>Até ${TABELA.kmInclusos} km</span><b>${brl(TABELA.base)}</b></div>
        <div class="linha"><span>Cada km a mais</span><b>${brl(TABELA.porKm)}</b></div>
        <div class="linha"><span>Chuva</span><b>+${brl(TABELA.chuva)}</b></div>
        <div class="linha"><span>Espera acima de ${TABELA.esperaGratisMin} min</span><b>${brl(TABELA.esperaPorMin)}/min</b></div>
        <div class="linha"><span>Cancelar depois do aceite</span><b>${brl(TABELA.deslocamentoCancelado)}</b></div>
        <div class="linha"><span>Taxa do app por chamado</span><b>${brl(TABELA.taxaPlataforma)}</b></div>
        <p class="sub mt8">O frete vai inteiro pro motoboy. Deixar o pedido pronto antes de chamar evita taxa de espera e melhora sua nota com os motoboys.</p>
      </section>`
  }
};

/* ============ Partes vivas ============ */
let oferta = { id: null, ate: 0 };
let ultimaAtiva = null;
let avaliacao = { id: null, nota: 0, tags: [] };

const LIVE = {
  'mb-status': el => {
    const s = S();
    html(el, `<div class="status ${s.online && !emPausa() ? 'on' : ''}">
      <button class="chave" role="switch" aria-checked="${s.online}" aria-label="Receber chamados" data-act="online"></button>
      <div class="txt">${emPausa()
        ? `<b>Em pausa</b><small>Volta em <span class="num" data-ate="${s.pausaAte}">--:--</span>. Água, alongamento, respira.</small>`
        : s.online
          ? `<b>Online</b><small>Recebendo chamados há <span class="num" data-desde="${s.onlineDesde}">--:--</span></small>`
          : `<b>Offline</b><small>Liga a chave pra receber chamados</small>`}</div></div>`);
  },
  'mb-meta': el => {
    // Durante oferta ou corrida, a tela é só dela: a meta volta quando o motoboy estiver livre.
    if (corridaAtiva() || aAvaliar() || (S().online && !emPausa() && ofertaAtual())) { html(el, ''); return; }
    const h =resumoDia(S().calls, S().profile), meta = S().profile.meta;
    const pct = meta ? Math.min(100, h.bruto / meta * 100) : 0;
    html(el, `<section class="bloco meta">
      <div class="topo"><span>Hoje <b class="num">${brl(h.bruto)}</b></span><small class="mudo">meta ${brl(meta)}</small></div>
      <div class="barra" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Meta do dia"><i data-w="${pct}"></i></div>
      <small class="mudo">${h.n} ${h.n === 1 ? 'entrega' : 'entregas'}, ${km(h.km)} km. Lucro depois da gasolina: <b class="claro">${brl(h.bruto - h.comb)}</b></small>
      ${meta ? `<p class="falta">${h.bruto >= meta ? 'Meta batida. O que vier agora é extra.' : `Faltam <b>${brl(meta - h.bruto)}</b>, umas ${Math.ceil((meta - h.bruto) / ticketMedio(S().calls))} corridas.`}</p>` : ''}
    </section>`);
  },
  'mb-main': el => {
    const ativa = corridaAtiva();
    if (ultimaAtiva && !ativa) {
      const c = S().calls.find(x => x.id === ultimaAtiva);
      if (c && c.status === 'cancelado') toast(`A empresa cancelou. Você recebe ${brl(c.compensacao)} pelo deslocamento.`);
    }
    ultimaAtiva = ativa ? ativa.id : null;

    if (ativa) { html(el, telaCorrida(ativa)); return; }
    const av = aAvaliar();
    if (av) { html(el, telaAvaliar(av)); return; }
    const livre = S().online && !emPausa();
    const of = livre ? ofertaAtual() : null;
    if (of) {
      if (oferta.id !== of.id) {
        oferta = { id: of.id, ate: Date.now() + TABELA.tempoOferta * 1000 };
        bipe();
        anunciar(`Novo chamado de ${of.empresa}: ${brl(of.valor)}, ${km(of.km)} quilômetros.`);
      }
      html(el, telaOferta(of)); return;
    }
    oferta = { id: null, ate: 0 };
    html(el, `<div class="radar ${livre ? '' : 'parado'}"><div class="onda">${ic('moto')}</div></div>
      <div class="vazio colado">${livre
        ? `<b>Procurando chamados perto de você</b>Quando uma empresa chamar, o valor aparece aqui antes de você decidir.`
        : `<b>Você está offline</b>Fica online quando quiser rodar. Ninguém te cobra horário.`}</div>
      ${!S().online ? (S().profile.nome
        ? `<button class="btn btn-sinal btn-online" data-act="online">${ic('moto')}Ficar online</button>`
        : `<button class="btn btn-sinal btn-online" data-act="aba" data-aba="perfil">${ic('perfil')}Cadastrar meus dados pra rodar</button>`) : ''}
      ${livre ? `<button class="btn btn-fantasma btn-sm" data-act="simular">Receber um chamado de teste</button>
      <button class="btn btn-fantasma btn-sm mt8" data-act="pausa">Fazer uma pausa de 15 min</button>` : ''}`);
  },
  'mb-ganhos': el => {
    const s = S(), sd = saldo(s.calls, s.saques), h = resumoDia(s.calls, s.profile);
    const todos = meusGanhos().sort((a, b) => quandoGanhou(b) - quandoGanhou(a));
    const dias = [...Array(7)].map((_, i) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return d; });
    const vals = dias.map(d => r2(todos.filter(c => mesmoDia(quandoGanhou(c), d)).reduce((a, c) => a + ganho(c), 0)));
    const max = Math.max(...vals, 1);
    const extrato = [
      ...todos.map(c => ({ t: quandoGanhou(c), html: `<li><div>${esc(c.empresa)}<small>${c.status === 'cancelado' ? 'Cancelada pela empresa, deslocamento pago' : `${km(c.km)} km${c.espera ? `, espera ${brl(c.espera)}` : ''}${c.gorjeta ? `, gorjeta ${brl(c.gorjeta)}` : ''}`}, ${dia(quandoGanhou(c))} ${hora(quandoGanhou(c))}</small></div><b>${brl(ganho(c))}</b></li>` })),
      ...s.saques.map(q => ({ t: q.em, html: `<li><div>Saque Pix<small>${esc(q.pix)}, ${dia(q.em)} ${hora(q.em)}</small></div><b class="mudo">− ${brl(q.valor)}</b></li>` }))
    ].sort((a, b) => b.t - a.t).slice(0, 40);
    html(el, `<section class="saldo">
        <small>Disponível pra sacar</small><b>${brl(sd)}</b>
        <button class="btn" data-act="sacar" ${sd <= 0 ? 'disabled' : ''}>Sacar agora via Pix, sem taxa</button>
      </section>
      <section class="bloco"><h2>Hoje, na ponta do lápis</h2>
        <div class="linha"><span>Ganhos</span><b class="num">${brl(h.bruto)}</b></div>
        <div class="linha"><span>Gasolina (${km(h.km)} km)</span><b class="num">− ${brl(h.comb)}</b></div>
        <div class="linha"><span>Lucro real</span><b class="num lucro">${brl(h.bruto - h.comb)}</b></div>
        <p class="sub mt6">Calculado com ${km(s.profile.consumo)} km/l e gasolina a ${brl(s.profile.gasolina)}. Ajuste no Perfil.</p>
      </section>
      <section class="bloco"><h2>Últimos 7 dias: ${brl(vals.reduce((a, b) => a + b, 0))}</h2>
        <div class="barras" role="img" aria-label="Ganhos por dia: ${dias.map((d, i) => `${d.toLocaleDateString('pt-BR', { weekday: 'long' })} ${brl(vals[i])}`).join(', ')}">${dias.map((d, i) =>
          `<div class="${i === 6 ? 'hoje' : ''}"><i data-h="${vals[i] / max * 100}"></i><small>${d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</small></div>`).join('')}</div>
      </section>
      ${(() => {
        const fx = faixasHorario(s.calls);
        if (fx.reduce((a, f) => a + f.n, 0) < 3) return '';
        const topo = fx[0].total;
        return `<section class="bloco"><h2>Seus horários que mais rendem</h2><ul class="horas">${fx.slice(0, 4).map(f =>
          `<li><span><b>${f.nome}</b> <small>${f.de}h–${f.ate}h</small></span><b class="num">${brl(f.total)}</b><small>${f.n} ${f.n === 1 ? 'entrega' : 'entregas'}</small><div class="barra"><i data-w="${f.total / topo * 100}"></i></div></li>`).join('')}</ul>
          <p class="sub mt8">Conta as entregas feitas no app. Use pra decidir quando vale mais a pena rodar.</p></section>`;
      })()}
      <button class="btn btn-fantasma mb14" data-act="informe">${ic('doc')}Informe do mês em PDF</button>
      <section class="bloco"><h2>Extrato</h2>${extrato.length ? `<ul class="hist">${extrato.map(x => x.html).join('')}</ul>`
        : `<div class="vazio"><b>Nenhuma corrida ainda</b>Fica online na aba Corridas e seu extrato começa aqui.</div>`}</section>`);
  },
  'mb-apoio': el => {
    const s = S(), p = s.profile;
    const rodado = r2(s.calls.filter(c => c.motoboy && c.status === 'entregue' && (c.entregueEm || 0) > p.oleoDesde).reduce((a, c) => a + c.km, 0));
    const pct = Math.min(100, rodado / p.oleoCada * 100), falta = Math.max(0, p.oleoCada - rodado);
    const tempo = s.online && s.onlineDesde ? (Date.now() - s.onlineDesde) / 60000 : 0;
    html(el, `${tempo >= 120 ? `<div class="aviso">Você está online há ${Math.floor(tempo / 60)}h${String(Math.floor(tempo % 60)).padStart(2, '0')}. Uma pausa de 15 min reduz o cansaço no trânsito. <button class="link" data-act="pausa">Pausar agora</button></div>` : ''}
      <section class="bloco meta"><h2>Manutenção da moto</h2>
        <div class="topo"><span>Óleo: <b class="num">${km(rodado)} km</b> rodados</span><small class="mudo">troca a cada ${km(p.oleoCada)} km</small></div>
        <div class="barra"><i data-w="${pct}" class="${pct >= 90 ? 'alerta' : ''}"></i></div>
        <p class="sub mt8">${falta > 0 ? `Faltam ${km(falta)} km pra próxima troca.` : 'Passou da hora de trocar o óleo.'} Conta só os km das entregas feitas no app.</p>
        <button class="btn btn-fantasma btn-sm mt10" data-act="oleo">Troquei o óleo hoje</button>
      </section>`);
  },
  'em-preco': el => {
    const f = $('[data-form="chamado"]'); if (!f) return;
    const v = frete(numero(f.km.value, LIMITES.kmMin, LIMITES.kmMax, 0), f.chuva.checked);
    html(el, `<div class="preco">
      <div class="linha"><span>Frete (vai inteiro pro motoboy)</span><b>${brl(v)}</b></div>
      <div class="linha"><span>Taxa do app</span><b>${brl(TABELA.taxaPlataforma)}</b></div>
      <div class="total"><span>Você paga</span><b>${brl(v + TABELA.taxaPlataforma)}</b></div>
    </div>`);
    const cta = $('[data-cta]'); if (cta) cta.textContent = `Chamar motoboy por ${brl(v + TABELA.taxaPlataforma)}`;
  },
  'em-rep': el => {
    const nome = S().empresa.nome;
    if (!nome) { html(el, ''); return; }
    const r = reputacao(S().calls, nome);
    html(el, r ? `<section class="bloco"><h2>O que os motoboys acham de você</h2>
      <div class="grade2"><div class="mini"><b>★ ${r.nota.toFixed(1).replace('.', ',')}</b><small>${r.n} ${r.n === 1 ? 'avaliação' : 'avaliações'}</small></div>
      <div class="mini"><b>${r.espera != null ? Math.round(r.espera) + ' min' : '–'}</b><small>espera média no balcão</small></div></div>
      <div class="rep">${Object.entries(r.tags).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<span class="tag ${TAGS_BOAS.includes(t) ? 'boa' : 'ruim'}">${esc(t)} (${n})</span>`).join('')}</div>
      <p class="sub">Essa nota aparece pros motoboys antes de aceitarem seu chamado.</p></section>` : '');
  },
  'em-lista': el => {
    const nome = S().empresa.nome;
    const cs = nome ? S().calls.filter(c => c.empresa === nome && !c.teste).sort((a, b) => b.criadoEm - a.criadoEm) : [];
    if (!cs.length) { html(el, `<div class="vazio"><b>Nenhum chamado ainda</b>Chame um motoboy na aba Chamar.</div><button class="btn btn-sinal" data-act="aba" data-aba="novo">Chamar motoboy</button>`); return; }
    const resumo = resumoMesEmpresa(nome);
    const ROT = { aberto: ['Procurando motoboy', 'aberto'], aceito: ['Motoboy a caminho da loja', 'andando'], coleta: ['Motoboy no balcão', 'andando'], coletado: ['Saiu pra entrega', 'andando'], entregue: ['Entregue', 'entregue'], cancelado: ['Cancelado', 'cancelado'] };
    html(el, resumo + cs.slice(0, 30).map(c => {
      const [rot, cls] = ROT[c.status];
      const emAndamento = c.status === 'aberto' || ATIVOS.includes(c.status);
      return `<article class="chamado">
        <div class="cab"><b>${esc(c.cliente || 'Entrega')}, ${hora(c.criadoEm)}</b><span class="pill ${cls}">${rot}</span></div>
        <div class="mudo pq">${esc(c.entrega)} (${km(c.km)} km)</div>
        ${c.motoboy ? `<div class="mt6">Motoboy: <b>${esc(c.motoboy)}</b>${c.moto ? `, ${esc(c.moto)}` : ''}${c.placa ? `, placa ${esc(c.placa)}` : ''}</div>` : ''}
        ${c.status === 'coleta' ? `<div class="aviso">Esperando há <b class="num" data-desde="${c.chegouEm}">--:--</b>. Depois de ${TABELA.esperaGratisMin} min, a espera custa ${brl(TABELA.esperaPorMin)}/min.</div>` : ''}
        ${emAndamento ? `<div class="mt8"><small class="mudo">Código de entrega (passe só pro cliente)</small><div class="codigo">${c.codigo}</div></div>
          <a class="btn btn-ok btn-sm mt10" href="${esc(linkCliente(c))}" target="_blank" rel="noopener noreferrer">${ic('balao')}Avisar cliente no WhatsApp</a>` : ''}
        ${c.status === 'entregue' ? `<div class="mudo pq mt6">Frete ${brl(c.valor)}${c.espera ? ` + espera ${brl(c.espera)}` : ''}${c.gorjeta ? ` + gorjeta ${brl(c.gorjeta)}` : ''}</div>
          ${c.gorjeta ? '' : `<div class="acoes acoes3">${LIMITES.gorjetas.map(v => `<button class="btn btn-fantasma btn-sm" data-act="gorjeta" data-id="${esc(c.id)}" data-v="${v}">+${brl(v)}</button>`).join('')}</div><small class="mudo">Mandar gorjeta pro motoboy</small>`}` : ''}
        ${c.status === 'cancelado' && c.compensacao ? `<div class="mudo pq mt6">Deslocamento pago ao motoboy: ${brl(c.compensacao)}</div>` : ''}
        ${!emAndamento ? `<button class="btn btn-fantasma btn-sm mt10" data-act="repetir" data-id="${esc(c.id)}">${ic('repetir')}Chamar de novo</button>` : ''}
        ${podeIr(c.status, 'cancelado') ? `<button class="btn btn-fantasma btn-sm mt10" data-act="cancelar" data-id="${esc(c.id)}">Cancelar chamado</button>` : ''}
      </article>`;
    }).join(''));
  }
};

function telaOferta(c) {
  const r = reputacao(S().calls, c.empresa);
  const porKm = c.valor / c.km;
  const lucro = c.valor - c.km * custoKm(S().profile);
  const resta = Math.max(0, oferta.ate - Date.now());
  const outras = ofertasAbertas().filter(x => x.id !== c.id).slice(0, 4);
  return `<section class="oferta">
    <h2 class="vh">Novo chamado</h2>
    <div class="placa">
      <div class="faixa-azul"><span>Novo chamado</span><span>${esc(c.empresa)}</span></div>
      <div class="valor num">${brl(c.valor)}</div>
      <div class="porkm">${brl(porKm)} por km, sobra ${brl(lucro)} depois da gasolina</div>
    </div>
    <div class="bloco mt14">
      ${mapa(c, 'oferta')}
      <ul class="rota">
        <li><b>${esc(c.empresa)}</b><small>${esc(c.coleta)}</small></li>
        <li><b>${esc(c.entrega)}</b><small>${km(c.km)} km da loja até o cliente</small></li>
      </ul>
      <div class="rep">
        ${r ? `<span class="tag ${r.nota >= 4 ? 'boa' : r.nota < 3 ? 'ruim' : ''}">★ ${r.nota.toFixed(1).replace('.', ',')} pelos motoboys</span>${r.espera != null ? `<span class="tag ${r.espera > TABELA.esperaGratisMin ? 'ruim' : 'boa'}">espera média ${Math.round(r.espera)} min</span>` : ''}` : '<span class="tag">Empresa ainda sem avaliação</span>'}
        ${c.chuva ? `<span class="tag info">+${brl(TABELA.chuva)} de chuva incluso</span>` : ''}
      </div>
      ${c.obs ? `<div class="aviso">${esc(c.obs)}</div>` : ''}
      <div class="contagem"><i data-oferta data-w="${resta / (TABELA.tempoOferta * 10)}"></i></div>
      <div class="contagem-linha"><small class="mudo">Tempo pra decidir</small><button class="link pq" data-act="maisTempo">+${TABELA.maisTempoOferta} segundos</button></div>
      <div class="deslize">
        <div class="deslize-rastro"></div>
        <div class="deslize-texto"><span>Deslize pra aceitar</span></div>
        <button class="deslize-alca" data-act="armar" data-id="${esc(c.id)}" aria-label="Aceitar corrida de ${brl(c.valor)}. Arraste até o fim ou toque duas vezes.">${ic('seta')}</button>
      </div>
      <button class="btn btn-fantasma btn-sm mt10" data-act="recusar" data-id="${esc(c.id)}">Recusar</button>
      <p class="semPunicao">Recusar não te prejudica em nada.</p>
    </div>
    ${outras.length ? `<div class="outras"><h3>Outros chamados abertos (${outras.length})</h3>${outras.map(o =>
      `<button class="item-oferta" data-act="escolher" data-id="${esc(o.id)}"><span>${esc(o.empresa)}<small>${km(o.km)} km, ${brl(o.valor / o.km)} por km</small></span><b>${brl(o.valor)}</b></button>`).join('')}</div>` : ''}
  </section>`;
}

function telaCorrida(c) {
  const passo = { aceito: 0, coleta: 1, coletado: 2 }[c.status];
  const naLoja = c.status !== 'coletado';
  const alvo = naLoja ? c.coleta : c.entrega;
  const tel = fone(c.tel);
  const titulo = { aceito: 'Vai até a loja', coleta: 'Esperando o pedido', coletado: 'Leva até o cliente' }[c.status];
  const etapas = ['Indo à loja', 'Na loja', 'Entregando', 'Entregue'];
  return `<ol class="passos" aria-label="Etapa ${passo + 1} de 4: ${etapas[passo]}">${etapas.map((n, i) =>
      `<li class="${i < passo ? 'feito' : i === passo ? 'agora' : ''}" ${i === passo ? 'aria-current="step"' : ''}>${n}</li>`).join('')}</ol>
    ${mapa(c, { aceito: 'loja', coleta: 'naloja', coletado: 'cliente' }[c.status])}
    <section class="bloco">
      <h2 class="sub">${titulo}</h2>
      <p class="destino">${esc(naLoja ? c.empresa : (c.cliente || 'Cliente'))}</p>
      <p class="mudo">${esc(alvo)}</p>
      ${c.status === 'coleta' ? `<div class="espera-box"><div class="relogio" data-desde="${c.chegouEm}" role="timer" aria-label="Tempo de espera">--:--</div>
        <p class="sub" data-espera="${esc(c.id)}"></p></div>` : ''}
      ${c.obs && c.status !== 'coleta' ? `<div class="aviso">${esc(c.obs)}</div>` : ''}
      <div class="acoes">
        <a class="btn btn-azul btn-sm" href="${esc(mapsUrl(alvo))}" target="_blank" rel="noopener noreferrer">${ic('nav')}Google Maps</a>
        <a class="btn btn-azul btn-sm" href="${esc(wazeUrl(alvo))}" target="_blank" rel="noopener noreferrer">${ic('nav')}Waze</a>
      </div>
      ${tel ? `<div class="acoes"><a class="btn btn-fantasma btn-sm" href="tel:+${tel}">${ic('fone')}Ligar pra loja</a><a class="btn btn-fantasma btn-sm" href="https://wa.me/${tel}" target="_blank" rel="noopener noreferrer">${ic('balao')}WhatsApp</a></div>` : ''}
    </section>
    <div class="grade2 mb12">
      <div class="mini"><b>${brl(c.valor)}</b><small>frete garantido</small></div>
      <div class="mini"><b>${km(c.km)} km</b><small>até o cliente</small></div>
    </div>
    <div class="cta-fixa">
    ${c.status === 'aceito' ? `<button class="btn btn-sinal" data-act="cheguei" data-id="${esc(c.id)}">${ic('loja')}Cheguei na loja</button>` : ''}
    ${c.status === 'coleta' ? `<button class="btn btn-sinal" data-act="coletei" data-id="${esc(c.id)}">${ic('caixa')}Peguei o pedido</button>` : ''}
    ${c.status === 'coletado' ? `<button class="btn btn-ok" data-act="entregar" data-id="${esc(c.id)}">${ic('check')}Finalizar entrega</button>` : ''}
    </div>`;
}

function telaAvaliar(c) {
  if (avaliacao.id !== c.id) avaliacao = { id: c.id, nota: 0, tags: [] };
  const chip = t => `<button type="button" data-act="tag" data-t="${esc(t)}" aria-pressed="${avaliacao.tags.includes(t)}">${esc(t)}</button>`;
  const minutos = c.aceitoEm && c.entregueEm ? Math.max(1, Math.round((c.entregueEm - c.aceitoEm) / 60000)) : null;
  return `<section class="bloco centro resumo">
    <h2 class="sub">Entrega feita</h2>
    <p class="relogio ganho">+${brl(ganho(c))}</p>
    <p class="sub mb14">${c.espera ? `Inclui ${brl(c.espera)} de espera. ` : ''}Já está no seu saldo.</p>
    <div class="grade3">
      <div class="mini"><b>${brl(c.valor)}</b><small>frete</small></div>
      <div class="mini"><b>${km(c.km)} km</b><small>rodados</small></div>
      <div class="mini"><b>${minutos != null ? minutos + ' min' : '–'}</b><small>do aceite à entrega</small></div>
    </div>
  </section>
  <section class="bloco">
    <h2>Como foi com ${esc(c.empresa)}?</h2>
    <p class="sub">Sua nota ajuda outros motoboys a decidir. A empresa não vê quem avaliou.</p>
    <div class="estrelas" role="group" aria-label="Nota de 1 a 5">${[1, 2, 3, 4, 5].map(n => `<button aria-pressed="${avaliacao.nota === n}" aria-label="${n} de 5" class="${n <= avaliacao.nota ? 'on' : ''}" data-act="nota" data-n="${n}">★</button>`).join('')}</div>
    <div class="chips" role="group" aria-label="O que aconteceu">${TAGS_BOAS.map(chip).join('')}${TAGS_RUINS.map(chip).join('')}</div>
    <button class="btn btn-sinal" data-act="avaliar" data-id="${esc(c.id)}" ${avaliacao.nota ? '' : 'disabled'}>Enviar avaliação</button>
    <button class="btn btn-fantasma btn-sm mt8" data-act="pularAval" data-id="${esc(c.id)}">Pular</button>
  </section>`;
}

function refresh() {
  document.querySelectorAll('[data-live]').forEach(el => LIVE[el.dataset.live]?.(el));
  const b = document.querySelector('[data-badge="corridas"]');
  if (b) b.className = aba !== 'corridas' && (corridaAtiva() || (S().online && ofertaAtual())) ? 'dot' : '';
  const e = document.querySelector('[data-badge="chamados"]');
  if (e) e.className = aba !== 'chamados' && S().calls.some(c => c.empresa === S().empresa.nome && ATIVOS.includes(c.status)) ? 'dot' : '';
  tick();
}
aoMudar(refresh);

/* ============ Relógio (1s) ============ */
function tick() {
  const agora = Date.now();
  document.querySelectorAll('[data-desde]').forEach(el => { el.textContent = mmss(agora - +el.dataset.desde); });
  document.querySelectorAll('[data-ate]').forEach(el => { el.textContent = mmss(+el.dataset.ate - agora); });
  document.querySelectorAll('[data-espera]').forEach(el => {
    const c = S().calls.find(x => x.id === el.dataset.espera); if (!c) return;
    const v = taxaEspera(c, agora);
    html(el, v > 0 ? `Taxa de espera rodando: <b class="lucro">+${brl(v)}</b>` : `A partir de ${TABELA.esperaGratisMin} min, a espera passa a valer ${brl(TABELA.esperaPorMin)}/min pra você.`);
  });
  const barra = document.querySelector('[data-oferta]');
  if (barra && oferta.id) {
    const resta = oferta.ate - agora;
    barra.style.width = Math.max(0, Math.min(100, resta / (TABELA.tempoOferta * 10))) + '%';
    if (resta <= 0) {
      const id = oferta.id; oferta = { id: null, ate: 0 };
      toast('O chamado passou. Sem problema, nada muda pra você.');
      mudar(s => { s.recusados.push(id); });
    }
  }
  if (S().pausaAte && S().pausaAte <= agora) {
    mudar(s => { s.pausaAte = null; });
    if (papel === 'moto') toast('Pausa encerrada. Você está online de novo.');
  }
}
setInterval(tick, 1000);

/* ============ Ações ============ */
const acharEm = (s, id) => s.calls.find(x => x.id === id);

const vibrar = ms => { try { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(ms); } catch {} };

function aceitarChamado(id) {
  let motivo = 'Esse chamado já não está disponível.';
  const ok = mudar(s => {
    const c = acharEm(s, id);
    if (!c || !podeIr(c.status, 'aceito')) return false;
    if (s.calls.some(x => x.motoboy && ATIVOS.includes(x.status))) { motivo = 'Termine a corrida atual antes de aceitar outra.'; return false; }
    Object.assign(c, { status: 'aceito', motoboy: s.profile.nome, moto: s.profile.moto, placa: s.profile.placa, aceitoEm: Date.now() });
  });
  oferta = { id: null, ate: 0 }; armado = null; escolhida = null;
  if (ok) { vibrar(30); scrollTo(0, 0); }
  toast(ok ? 'Corrida aceita. Bora!' : motivo);
}

/* Arrastar a alça até o fim aceita. Soltar antes volta pro começo. */
let arrasto = null, armado = null, ignorarClique = false;
document.addEventListener('pointerdown', e => {
  const alca = e.target.closest('.deslize-alca'); if (!alca) return;
  const trilho = alca.closest('.deslize');
  trilho.classList.remove('solto');
  arrasto = { alca, trilho, x0: e.clientX, max: trilho.clientWidth - alca.offsetWidth - 12, dx: 0, id: alca.dataset.id };
  alca.setPointerCapture?.(e.pointerId);
});
document.addEventListener('pointermove', e => {
  if (!arrasto) return;
  const dx = Math.max(0, Math.min(arrasto.max, e.clientX - arrasto.x0));
  arrasto.dx = dx;
  arrasto.alca.style.transform = 'translateX(' + dx + 'px)';
  arrasto.trilho.querySelector('.deslize-rastro').style.width = (dx + 66) + 'px';
});
function soltar() {
  if (!arrasto) return;
  const { alca, trilho, dx, max, id } = arrasto;
  arrasto = null;
  if (dx > 8) ignorarClique = true;
  if (dx >= max * 0.85) { aceitarChamado(id); return; }
  trilho.classList.add('solto');
  alca.style.transform = '';
  trilho.querySelector('.deslize-rastro').style.width = '';
}
document.addEventListener('pointerup', soltar);
document.addEventListener('pointercancel', soltar);

const ACTS = {
  entrar: el => entrar(el.dataset.papel === 'empresa' ? 'empresa' : 'moto'),
  trocar: () => { papel = null; aba = null; sessao.set('papel', null); sessao.set('aba', null); montar(); },
  aba: el => irAba(el.dataset.aba),
  fechar: () => fecharDialogo(),
  tema: () => {
    tema = tema === 'sol' ? 'noite' : 'sol';
    try { localStorage.setItem('marcaai:tema', tema); } catch {}
    // Só troca as cores: não redesenha a tela, pra não apagar formulário em andamento.
    aplicarTema();
    document.querySelectorAll('[data-act="tema"]').forEach(b => b.setAttribute('aria-pressed', String(tema === 'sol')));
    toast(tema === 'sol' ? 'Modo sol ligado: tela clara pra ler na rua.' : 'Modo noite ligado.');
  },
  repetir: el => {
    const c = S().calls.find(x => x.id === el.dataset.id); if (!c) return;
    rascunho = { entrega: c.entrega, km: c.km, cliente: c.cliente, telCliente: c.telCliente, obs: c.obs };
    irAba('novo');
    toast('Dados da entrega copiados. Confira e chame o motoboy.');
  },
  informe: () => {
    const s = S(), p = s.profile, inf = informeMes(s.calls, s.saques, p);
    if (!inf.linhas.length) { toast('Ainda não tem corrida paga este mês pra entrar no informe.'); return; }
    const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    html(document.getElementById('impressao'), `<h1>Informe de ganhos: ${esc(mes)}</h1>
      <p>${esc(p.nome)}${p.placa ? `, placa ${esc(p.placa)}` : ''}${p.moto ? `, ${esc(p.moto)}` : ''}. Gerado pelo Marca aí em ${dia(Date.now())} às ${hora(Date.now())}.</p>
      <table><thead><tr><th>Data</th><th>Empresa</th><th class="v">Km</th><th class="v">Valor</th></tr></thead><tbody>
      ${inf.linhas.map(l => `<tr><td>${dia(l.em)} ${hora(l.em)}</td><td>${esc(l.empresa)}${l.cancelada ? ' (cancelada, deslocamento)' : ''}</td><td class="v">${km(l.km)}</td><td class="v">${brl(l.valor)}</td></tr>`).join('')}
      <tr class="tot"><td colspan="2">${inf.corridas} ${inf.corridas === 1 ? 'entrega' : 'entregas'}</td><td class="v">${km(inf.km)}</td><td class="v">${brl(inf.bruto)}</td></tr>
      </tbody></table>
      <p>Gasolina estimada (${km(p.consumo)} km/l a ${brl(p.gasolina)}): ${brl(inf.comb)}. Lucro estimado: <b>${brl(inf.bruto - inf.comb)}</b>. Sacado no mês: ${brl(inf.sacado)}.</p>
      <p class="nota">Documento de controle pessoal. Não substitui nota fiscal nem declaração oficial; use como apoio pra declarar sua renda como MEI.</p>`);
    print();
  },
  km: el => {
    const inp = el.closest('form').km;
    inp.value = String(r2(Math.min(LIMITES.kmMax, Math.max(LIMITES.kmMin, numero(inp.value, 0, LIMITES.kmMax, 3) + +el.dataset.d))));
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  },
  online: () => {
    if (!S().profile.nome) { toast('Preencha seu nome no Perfil antes de ficar online.'); irAba('perfil'); return; }
    const ligar = !S().online;
    mudar(s => { s.online = ligar; s.onlineDesde = ligar ? Date.now() : null; s.pausaAte = null; if (ligar) s.recusados = []; });
    toast(ligar ? 'Você está online.' : 'Você está offline. Bom descanso.');
  },
  pausa: () => {
    mudar(s => { s.pausaAte = Date.now() + 15 * 60000; });
    toast('Pausa de 15 min. Nenhum chamado vai tocar.');
    if (aba !== 'corridas') irAba('corridas');
  },
  maisTempo: () => { if (oferta.id) { oferta.ate += TABELA.maisTempoOferta * 1000; toast(`Mais ${TABELA.maisTempoOferta} segundos pra decidir.`); } },
  simular: () => {
    const lojas = [['Lanchonete Teste', 'Rua de Teste, 100, Centro'], ['Farmácia Teste', 'Av. Exemplo, 250, Centro'], ['Pizzaria Teste', 'Praça Modelo, 12']];
    const [empresa, coleta] = lojas[+novoCodigo() % lojas.length];
    const dist = r2(1.5 + (+novoCodigo() % 600) / 100);
    mudar(s => {
      s.calls.push({ id: novoId(), empresa, coleta, tel: '', entrega: `Rua do Cliente, ${10 + (+novoCodigo() % 900)}, Bairro Teste`, cliente: 'Cliente teste',
        km: dist, obs: '', chuva: +novoCodigo() % 10 < 3, teste: true, codigo: novoCodigo(), status: 'aberto', criadoEm: Date.now() });
    });
  },
  aceitar: el => aceitarChamado(el.dataset.id),
  // Deslizador: toque na alça arma, segundo toque em até 4 s aceita (alternativa a arrastar).
  armar: el => {
    if (ignorarClique) { ignorarClique = false; return; }
    const id = el.dataset.id, trilho = el.closest('.deslize');
    if (armado === id) { aceitarChamado(id); return; }
    armado = id;
    trilho.classList.add('armado');
    trilho.querySelector('.deslize-texto span').textContent = 'Toque de novo pra aceitar';
    setTimeout(() => {
      if (armado !== id) return;
      armado = null;
      trilho.classList.remove('armado');
      const t = trilho.querySelector('.deslize-texto span'); if (t) t.textContent = 'Deslize pra aceitar';
    }, 4000);
  },
  escolher: el => { escolhida = el.dataset.id; oferta = { id: escolhida, ate: Date.now() + TABELA.tempoOferta * 1000 }; armado = null; refresh(); scrollTo(0, 0); },
  recusar: el => { oferta = { id: null, ate: 0 }; mudar(s => { s.recusados.push(el.dataset.id); }); toast('Recusado. Nada muda pra você.'); },
  cheguei: el => mudar(s => { const c = acharEm(s, el.dataset.id); if (!c || !podeIr(c.status, 'coleta')) return false; c.status = 'coleta'; c.chegouEm = Date.now(); }),
  coletei: el => {
    let espera = 0;
    mudar(s => {
      const c = acharEm(s, el.dataset.id); if (!c || !podeIr(c.status, 'coletado')) return false;
      c.coletouEm = Date.now(); c.espera = espera = taxaEspera(c); c.status = 'coletado';
    });
    if (espera) toast(`Espera de ${brl(espera)} somada ao seu ganho.`);
  },
  entregar: el => {
    const id = el.dataset.id;
    const c = S().calls.find(x => x.id === id);
    if (!c) return;
    dialogo(`<h3 id="dlg-titulo">Código de entrega</h3><p class="mudo mb14">Peça ao cliente os 4 números que a loja passou pra ele.</p>
      <form data-form="codigo" novalidate><input class="inp codigo-inp" name="cod" inputmode="numeric" maxlength="4" autocomplete="one-time-code" spellcheck="false" aria-label="Código de 4 números" aria-describedby="cod-erro" autofocus>
      <p id="cod-erro" class="erro" role="alert"></p>
      <button class="btn btn-ok" type="submit">Confirmar entrega</button></form>
      ${c.teste ? `<p class="sub mt10">Chamado de teste: o código é ${c.codigo}.</p>` : ''}`,
      d => d.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const cod = String(e.target.cod.value).replace(/\D/g, '');
        const erro = d.querySelector('#cod-erro');
        let res = '';
        mudar(s => {
          const x = acharEm(s, id);
          if (!x || !podeIr(x.status, 'entregue')) { res = 'sumiu'; return false; }
          if (x.bloqueadoAte && x.bloqueadoAte > Date.now()) { res = 'bloq'; return false; }
          if (cod !== x.codigo) {
            x.tentativas += 1;
            if (x.tentativas >= LIMITES.tentativasCodigo) { x.bloqueadoAte = Date.now() + LIMITES.bloqueioCodigoMs; x.tentativas = 0; res = 'bloqueou'; }
            else res = `errado:${LIMITES.tentativasCodigo - x.tentativas}`;
            return true;
          }
          Object.assign(x, { status: 'entregue', entregueEm: Date.now(), tentativas: 0, bloqueadoAte: null });
          res = 'ok';
        });
        if (res === 'ok') { fecharDialogo(); bipe(); vibrar([40, 60, 40]); scrollTo(0, 0); anunciar('Entrega confirmada.'); return; }
        if (res === 'sumiu') { fecharDialogo(); toast('A empresa mudou esse chamado. A tela já mostra como ele está agora.'); return; }
        e.target.cod.setAttribute('aria-invalid', 'true');
        erro.textContent = res === 'bloq' || res === 'bloqueou'
          ? 'Muitas tentativas erradas. Espere 2 minutos ou ligue pra loja e confirme o código.'
          : `Código não confere. Confira com o cliente. Restam ${res.split(':')[1]} tentativas.`;
      }));
  },
  nota: el => { avaliacao.nota = Math.min(5, Math.max(1, +el.dataset.n)); refresh(); $(`[data-act="nota"][data-n="${avaliacao.nota}"]`)?.focus(); },
  tag: el => {
    const t = el.dataset.t;
    avaliacao.tags = avaliacao.tags.includes(t) ? avaliacao.tags.filter(x => x !== t) : [...avaliacao.tags, t];
    refresh(); $(`[data-act="tag"][data-t="${CSS.escape(t)}"]`)?.focus();
  },
  avaliar: el => {
    const { nota, tags } = avaliacao;
    const ok = mudar(s => { const c = acharEm(s, el.dataset.id); if (!c || c.status !== 'entregue' || c.avaliado || !nota) return false; Object.assign(c, { avaliado: true, nota, tags }); });
    if (ok) toast('Avaliação enviada. Valeu!');
  },
  pularAval: el => mudar(s => { const c = acharEm(s, el.dataset.id); if (!c || c.status !== 'entregue') return false; c.avaliado = true; }),
  sacar: () => {
    const sd = saldo(S().calls, S().saques);
    if (!S().profile.pix) { toast('Cadastre sua chave Pix no Perfil.'); irAba('perfil'); return; }
    dialogo(`<h3 id="dlg-titulo">Sacar ${brl(sd)}</h3><p class="mudo mb14">Vai pra chave <b class="claro">${esc(S().profile.pix)}</b>. Sem taxa.</p>
      <div class="pilha"><button class="btn btn-sinal" data-act="confirmaSaque">Sacar ${brl(sd)}</button>
      <button class="btn btn-fantasma btn-sm" data-act="fechar">Agora não</button></div>
      <p class="sub mt10">Na versão de demonstração o saque é simulado.</p>`);
  },
  confirmaSaque: () => {
    let valor = 0;
    mudar(s => { valor = saldo(s.calls, s.saques); if (valor <= 0 || !s.profile.pix) return false; s.saques.push({ valor, pix: s.profile.pix, em: Date.now() }); });
    fecharDialogo();
    if (valor > 0) toast(`Saque de ${brl(valor)} enviado.`);
  },
  oleo: () => { mudar(s => { s.profile.oleoDesde = Date.now(); }); toast('Contador do óleo zerado.'); },
  sos: () => {
    const c = fone(S().profile.contato);
    dialogo(`<h3 id="dlg-titulo" class="h-freio">Emergência</h3><p class="mudo mb14">Toque pra ligar direto.</p>
      <div class="pilha">
        <a class="btn btn-freio" href="tel:190">Polícia, 190</a>
        <a class="btn btn-freio" href="tel:192">SAMU, 192</a>
        <a class="btn btn-fantasma" href="tel:193">Bombeiros, 193</a>
        <button class="btn btn-sinal" data-act="localizacao">${c ? 'Mandar minha localização pro meu contato' : 'Compartilhar minha localização'}</button>
        <button class="btn btn-fantasma btn-sm" data-act="fechar">Fechar</button>
      </div>
      ${c ? '' : `<p class="sub mt10">Cadastre um contato de emergência no Perfil pra mandar direto no WhatsApp dele.</p>`}`);
  },
  localizacao: () => {
    if (!navigator.geolocation) { toast('Este aparelho não informa a localização.'); return; }
    toast('Pegando sua localização…');
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude.toFixed(6), lon = pos.coords.longitude.toFixed(6);
      const txt = `Preciso de ajuda. Minha localização agora: https://maps.google.com/?q=${lat},${lon}`;
      const c = fone(S().profile.contato);
      if (c) location.href = `https://wa.me/${c}?text=${encodeURIComponent(txt)}`;
      else if (navigator.share) navigator.share({ text: txt }).catch(() => {});
      else navigator.clipboard?.writeText(txt).then(() => toast('Link da localização copiado.'), () => toast(txt));
    }, () => toast('Não deu pra pegar a localização. Libere o GPS e tente de novo.'), { enableHighAccuracy: true, timeout: 10000 });
  },
  cancelar: async el => {
    const id = el.dataset.id;
    const c = S().calls.find(x => x.id === id); if (!c) return;
    const paga = c.status !== 'aberto';
    const sim = await confirmar('Cancelar chamado?', paga
      ? `O motoboy já está a caminho e recebe ${brl(TABELA.deslocamentoCancelado)} pelo deslocamento.`
      : 'Nenhum motoboy aceitou ainda, então não há custo.', 'Cancelar chamado', 'Manter chamado');
    if (!sim) return;
    const ok = mudar(s => {
      const x = acharEm(s, id);
      if (!x || x.empresa !== s.empresa.nome || !podeIr(x.status, 'cancelado')) return false;
      const pagaAgora = x.status !== 'aberto';
      x.status = 'cancelado'; x.canceladoEm = Date.now(); x.compensacao = pagaAgora ? TABELA.deslocamentoCancelado : 0;
    });
    toast(ok ? 'Chamado cancelado.' : 'O motoboy já saiu com o pedido, então não dá mais pra cancelar. Ligue pra ele se precisar.');
  },
  gorjeta: el => {
    const v = +el.dataset.v; let quem = '';
    const ok = mudar(s => {
      const c = acharEm(s, el.dataset.id);
      if (!c || c.status !== 'entregue' || c.gorjeta || c.empresa !== s.empresa.nome || !LIMITES.gorjetas.includes(v)) return false;
      c.gorjeta = v; quem = c.motoboy;
    });
    if (ok) toast(`Gorjeta de ${brl(v)} enviada pra ${quem}.`);
  }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled && Object.hasOwn(ACTS, el.dataset.act)) { e.preventDefault(); ACTS[el.dataset.act](el); }
});

/* ============ Formulários ============ */
const atualizaPreco = e => { if (e.target.closest('[data-form="chamado"]')) LIVE['em-preco']($('[data-live="em-preco"]')); };
document.addEventListener('input', atualizaPreco);
document.addEventListener('change', atualizaPreco);

function erroForm(f, msg, campoNome) {
  f.querySelector('[data-erro]').textContent = msg;
  f.querySelectorAll('[aria-invalid]').forEach(n => n.removeAttribute('aria-invalid'));
  const alvo = campoNome && f.elements[campoNome];
  if (alvo) { alvo.setAttribute('aria-invalid', 'true'); alvo.focus(); }
}

document.addEventListener('submit', e => {
  const f = e.target, tipo = f.dataset.form;
  if (!tipo || tipo === 'codigo') return;
  e.preventDefault();
  const d = Object.fromEntries(new FormData(f));

  if (tipo === 'perfil') {
    const p = limparPerfil({ ...S().profile, ...d });
    if (!p.nome) return erroForm(f, 'Escreva seu nome.', 'nome');
    if (d.contato && !fone(p.contato)) return erroForm(f, 'Contato de emergência precisa ter DDD e número.', 'contato');
    mudar(s => { s.profile = { ...p, oleoDesde: s.profile.oleoDesde }; });
    toast('Dados salvos.'); montar();
  }
  if (tipo === 'empresa') {
    const emp = limparEmpresa(d);
    if (!emp.nome) return erroForm(f, 'Escreva o nome da empresa.', 'nome');
    mudar(s => { s.empresa = emp; });
    toast('Dados salvos.'); montar();
  }
  if (tipo === 'chamado') {
    if (!S().empresa.nome) { toast('Preencha o nome da empresa antes.'); irAba('loja'); return; }
    const coleta = texto(d.coleta, LIMITES.endereco), entrega = texto(d.entrega, LIMITES.endereco);
    const dist = numero(d.km, 0, Infinity, NaN);
    if (!coleta) return erroForm(f, 'Informe o endereço de retirada.', 'coleta');
    if (!entrega) return erroForm(f, 'Informe o endereço de entrega.', 'entrega');
    if (!(dist >= LIMITES.kmMin && dist <= LIMITES.kmMax)) return erroForm(f, `A distância precisa ficar entre ${km(LIMITES.kmMin)} e ${LIMITES.kmMax} km.`, 'km');
    mudar(s => {
      s.calls.push({ id: novoId(), empresa: s.empresa.nome, coleta, tel: s.empresa.tel, entrega, cliente: d.cliente, telCliente: d.telCliente, km: r2(dist), obs: d.obs,
        chuva: d.chuva === 'on', codigo: novoCodigo(), status: 'aberto', criadoEm: Date.now() });
    });
    toast('Chamado enviado. Avisando os motoboys online.');
    irAba('chamados');
  }
});

// Erros inesperados viram aviso claro, sem expor detalhe técnico na tela.
addEventListener('error', () => toast('Essa tela travou. Feche e abra o app de novo.'));
addEventListener('unhandledrejection', () => toast('Essa tela travou. Feche e abra o app de novo.'));

montar();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register(urlScript('sw.js')).catch(() => {});
