// Telas e ações do Marca aí.
import { TABELA, LIMITES, ATIVOS, TAGS_BOAS, TAGS_RUINS, podeIr, frete, taxaEspera, ganho, quandoGanhou, mesmoDia,
  custoKm, resumoDia, saldo, reputacao, novoCodigo, r2, ticketMedio, mensagemCliente, resumoMes, informeMes, faixasHorario,
  kmEstimado, etaMin, extrairGeo, PLANOS, taxaChamado, custoPlanos, kmCorrida,
  COBRANCAS, trocoLevar, avisoCobranca, estimativaCorrida, linkRastreio,
  alcance, raioOnda, perto, disponiveisNoRaio, RAIOS_MOTOBOY, RAIOS_BUSCA, RAIO_CONFERE_CHEGADA_M, RAIO_CLIENTE_M } from './regras.js';
import { ligarGps, desligarGps, estadoGps, aoMudarGps, pegarPosicao } from './gps.js';
import { mapaVivo, montarMapas, infoRota, aoMudarRota } from './mapa-vivo.js';
import * as nuvem from './nuvem.js';
import { ligarEfeitos } from './efeitos.js';
import { instalar, jaInstalado, ehIphone, aoMudarInstalar } from './instalar.js';
import { criarCorridas } from './corridas.js';
import { armazemLocal, armazemMisto } from './armazens.js';
import { limparPerfil, limparEmpresa, texto, numero, geo } from './esquema.js';
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
// Chamado com prioridade pros favoritos da loja só aparece pros outros depois que a janela acaba.
const visivelPraMim = c => !c.preferidos.length || c.preferidos.includes(S().profile.nome) || !c.prioridadeAte || c.prioridadeAte <= Date.now();
// Posição do motoboy só vale se for recente (2 min).
const posicaoAtual = () => (S().posicao && Date.now() - S().posicao.em < 120000 ? S().posicao : null);
// Como Uber Flash/99/iFood: só toca o que está dentro do raio dele e da onda atual do chamado,
// da loja mais perto pra mais longe (sem GPS, não dá pra filtrar: vem tudo, do mais antigo pro mais novo).
const ofertasAbertas = () => {
  const pos = posicaoAtual(), raio = S().profile.raio, agora = Date.now();
  return S().calls
    .filter(c => c.status === 'aberto' && !S().recusados.includes(c.id) && visivelPraMim(c))
    .map(c => ({ c, a: alcance(c, pos, raio, agora) }))
    .filter(x => x.a.ok)
    .sort((x, y) => (x.a.km ?? Infinity) - (y.a.km ?? Infinity) || x.c.criadoEm - y.c.criadoEm)
    .map(x => x.c);
};
const ateLoja = c => (posicaoAtual() && c.lojaGeo ? kmEstimado(posicaoAtual(), c.lojaGeo) : null);
const coordTxt = g => `${g.lat.toFixed(6)},${g.lon.toFixed(6)}`;
const hojeTxt = () => new Date().toLocaleDateString('sv');
const CHECKLIST = ['Pneus calibrados', 'Freio da frente e de trás', 'Farol, lanterna e seta', 'Capacete e viseira', 'Celular carregado e suporte firme'];
const feitosNoMes = () => resumoMes(S().calls, S().empresa.nome).total;
const taxaAgora = () => taxaChamado(S().empresa.plano, feitosNoMes());
const ofertaAtual = () => { const l = ofertasAbertas(); return l.find(c => c.id === escolhida) || l[0]; };

// Mapa do GPS (modelo Uber/iFood) em toda corrida: rota pelas ruas, recalculada quando o motoboy sai do caminho.
// Sem localização salva da loja ou do cliente, o mapa mostra o que tiver (a moto, a loja) e avisa o que falta.
const FASE_MAPA = { aceito: 'loja', coleta: 'naloja', coletado: 'cliente' };
function mapaCorrida(c, fase, moto) {
  const rotulo = fase === 'oferta' ? `Mapa: rota da ${c.empresa} até o cliente` : fase === 'loja' ? `Mapa: caminho até a ${c.empresa}` : fase === 'naloja' ? `Mapa: ${c.empresa} e o ponto de entrega` : 'Mapa: caminho até o cliente';
  const falta = fase === 'loja' ? !c.lojaGeo : fase === 'oferta' ? !(c.lojaGeo && c.clienteGeo) : !c.clienteGeo;
  // Antes do aceite, o servidor esconde o ponto do cliente (privacidade): ele existe, só aparece depois.
  const escondido = !c.clienteGeo && c.temGeoCliente;
  const aviso = !falta ? '' : `<p class="mapa-aviso">${fase === 'loja' || (fase === 'oferta' && !c.lojaGeo) ? 'A loja não salvou a localização no GPS. Use o endereço no Google Maps ou no Waze.'
    : escondido ? 'O ponto exato do cliente aparece no mapa depois que você aceitar.' : 'O cliente ainda não tem o ponto exato no mapa. Use o endereço no Google Maps ou no Waze.'}</p>`;
  return mapaVivo(c.id, { loja: c.lojaGeo, cliente: c.clienteGeo, moto, fase, rotulo }) + aviso;
}
// Quanto falta: pela rota das ruas quando ela já chegou; senão, estimativa em linha reta.
function faltaAte(c, pos, alvo) {
  const r = infoRota(c.id);
  if (r?.min != null && pos) return { km: r.km, min: r.min };
  if (!pos || !alvo) return null;
  const d = kmEstimado(pos, alvo);
  return { km: d, min: etaMin(d) };
}
const minTxt = n => (n === 1 ? '1 minuto' : `uns ${n} min`);
const emPausa = () => S().pausaAte && S().pausaAte > Date.now();
const meusGanhos = () => S().calls.filter(c => c.motoboy && ganho(c) > 0);

// Link do mapa ao vivo pro cliente (como o do iFood Sob Demanda e da Lalamove).
const linkMapaCliente = c => linkRastreio(location.href, c.rastreio);
function linkCliente(c) {
  return `https://wa.me/${fone(c.telCliente)}?text=${encodeURIComponent(mensagemCliente(c, linkMapaCliente(c)))}`;
}
// Resumo da cobrança na porta do cliente, pro motoboy e pra loja.
function textoCobranca(c, paraMotoboy) {
  if (c.cobranca === 'maquininha') return `Cobrar ${c.cobrar ? brl(c.cobrar) : 'o pedido'} na maquininha${paraMotoboy ? '. Pegue a maquininha na loja.' : '.'}`;
  if (c.cobranca === 'dinheiro') {
    const t = trocoLevar(c);
    return `Cobrar ${c.cobrar ? brl(c.cobrar) : 'o pedido'} em dinheiro${c.troco > 0 ? ` (troco pra ${brl(c.troco)})` : ''}.${paraMotoboy && t ? ` Leve ${brl(t)} de troco.` : ''}`;
  }
  return '';
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
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'sol' ? '#FFFFFF' : '#0A0A0A');
}
aplicarTema();

// Rascunho pra "Chamar de novo": preenche o formulário uma vez e some.
let rascunho = null;

let papel = sessao.get('papel', ['moto', 'empresa']);
let aba = papel ? sessao.get('aba', ABAS[papel].map(a => a[0])) || ABAS[papel][0][0] : null;

function entrar(p) {
  papel = p; sessao.set('papel', p);
  nuvem.conectar(p);
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
      <div class="top-linha">
        <div class="logo" translate="no">${ic('pin', 'class="pin"')}Marca aí</div>
        <button class="tema" role="switch" data-act="tema" aria-checked="${tema === 'sol'}" aria-label="Modo sol, tela clara pra ler no sol">${ic('sol')}<span>Modo sol</span><i class="mini-chave" aria-hidden="true"></i></button>
      </div>
      <div class="top-sub">
        <span class="quem">${esc(quem)}</span>
        <button class="link pq" data-act="trocar">Trocar perfil</button>
        ${jaInstalado() ? '' : `<button class="link pq atalho-instalar" data-act="instalar" data-instalar>${ic('baixar')}Instalar</button>`}
        <span class="top-status" data-live="nuvem-status"></span>
      </div>
    </header>
    <main id="view" class="cascata" data-tela="${papel}-${aba}"><h1 class="vh" tabindex="-1">${TITULOS[aba]}</h1>${VIEWS[papel][aba]()}</main>
    <nav class="tabs" aria-label="Seções">${ABAS[papel].map(([id, nome, i]) =>
      `<button data-act="aba" data-aba="${id}" ${id === aba ? 'aria-current="page"' : ''}>${ic(i)}${nome}<span data-badge="${id}"></span></button>`).join('')}</nav>`);
  refresh();
}

/* ============ Instalar na tela inicial ============ */
const cartaoInstalar = () => (jaInstalado() ? '' : `<section class="bloco instalar" data-instalar>
    <div class="instalar-icone" aria-hidden="true"><img src="icons/icon-192.png" alt="" width="52" height="52"></div>
    <div><h2>Marca aí na tela inicial</h2><p class="sub">Abre com um toque, em tela cheia, igual app de loja.</p></div>
    <button class="btn btn-sinal btn-sm" data-act="instalar">${ic('baixar')}Instalar</button>
  </section>`);
function passoAPasso() {
  const iphone = ehIphone();
  return `<h3 id="dlg-titulo">Pôr o Marca aí na tela inicial</h3>
    <ol class="passo-a-passo">${(iphone
      ? [`Toque no botão <b>Compartilhar</b> ${ic('compartilhar', 'class="em-linha"')} (embaixo no Safari, em cima no Chrome).`,
         'Role a lista e toque em <b>Adicionar à Tela de Início</b>.',
         'Toque em <b>Adicionar</b>. O ícone amarelo aparece na sua tela inicial.']
      : ['Toque no menu <b>⋮</b> do navegador (canto de cima).',
         'Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.',
         'Confirme. O ícone amarelo aparece na sua tela inicial.']).map(t => `<li>${t}</li>`).join('')}</ol>
    ${iphone ? '<p class="sub mt8">No iPhone, a Apple só deixa fazer isso pelo menu Compartilhar.</p>'
      : matchMedia('(pointer: coarse)').matches ? '' : '<p class="sub mt8">No computador, procure o ícone de instalar na barra de endereço.</p>'}
    <button class="btn btn-sinal btn-sm mt14" data-act="fechar">Entendi</button>`;
}
aoMudarInstalar(() => document.querySelectorAll('[data-instalar]').forEach(el => { el.hidden = jaInstalado(); }));

/* ============ Boas-vindas ============ */
function telaBoasVindas() {
  const porKm = brl(frete(5) / 5);
  return `<main class="welcome cascata" data-tela="boas-vindas">
    <div class="logo">${ic('pin', 'class="pin"')}</div>
    <h1 class="marca" translate="no">Marca<br><em>aí</em></h1>
    <p class="lead">O app de entrega que trabalha pro motoboy.</p>
    <figure class="vitrine" aria-label="Exemplo de chamado: ${brl(frete(5))} por 5 km">
      <div class="placa" data-3d="14" data-giro aria-hidden="true">
        <div class="faixa-azul"><span>Novo chamado</span><span>5 km</span></div>
        <div class="valor num">${brl(frete(5))}</div>
        <div class="porkm">Você vê o valor antes de aceitar</div>
      </div>
      <div class="chao" aria-hidden="true"></div>
    </figure>
    <div class="escolha">
      <button class="btn btn-sinal" data-act="entrar" data-papel="moto">${ic('moto', 'width="26" height="26"')}Sou motoboy</button>
      <button class="btn btn-fantasma" data-act="entrar" data-papel="empresa">${ic('loja', 'width="24" height="24"')}Sou empresa, quero chamar motoboy</button>
      ${jaInstalado() ? '' : `<button class="link-instalar" data-act="instalar" data-instalar>${ic('baixar')}Pôr o app na tela inicial do celular</button>`}
    </div>
    <section class="simulador" aria-labelledby="sim-rot">
      <h2 class="olho" id="sim-rot">Quanto custa uma entrega</h2>
      <div class="sim-linha">
        <div class="raio" role="radiogroup" aria-label="Distância da entrega">${[2, 4, 6, 8].map(k =>
          `<button type="button" role="radio" data-act="simKm" data-k="${k}" aria-checked="${k === 4}">${k} km</button>`).join('')}</div>
        <div class="sim-valor"><b class="num" data-sim-valor aria-live="polite">${brl(frete(4))}</b><small>vai inteiro pro motoboy</small></div>
      </div>
      <p class="sub">Precisa que ele volte com a maquininha? <b data-sim-volta>${brl(frete(4, false, true))}</b> com a volta. Sem mensalidade obrigatória.</p>
    </section>
    <div class="faixas" aria-hidden="true"><i></i></div>
    <h2 class="olho">O combinado com quem pilota</h2>
    <ul class="painel">
      <li class="destaque"><b class="num">${porKm}<small>/km</small></b><span>O valor e o R$ por km aparecem antes de você aceitar.</span></li>
      <li><b class="num">100%</b><span>do frete é seu. A taxa do app quem paga é a empresa.</span></li>
      <li><b class="num">0</b><span>punição por recusar. Sem bloqueio, sem perder vez.</span></li>
      <li><b class="num">${TABELA.esperaGratisMin}<small> min</small></b><span>de balcão. Passou disso, a espera é paga.</span></li>
      <li><b class="num">Pix</b><span>Saque na hora, sem taxa.</span></li>
    </ul>
    <p class="demo">${nuvem.nuvemLigada() ? 'Funciona entre celulares: abra num celular como empresa e em outro como motoboy.' : 'Modo demonstração: os dados ficam neste aparelho.'}</p>
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
    <div class="campo"><span>Localização da loja no GPS</span>
      <button type="button" class="btn btn-fantasma btn-sm" data-act="geoLoja">${ic('nav')}${S().empresa.geo ? 'Atualizar com minha localização' : 'Usar minha localização (estou na loja)'}</button>
      <small class="mudo dica" data-geo-loja>${S().empresa.geo ? 'Salva. O motoboy recebe a rota exata e o GPS registra a chegada dele.' : 'Recomendado: com ela o app calcula a distância sozinho e confirma a chegada do motoboy.'}</small>
    </div>
    <p class="erro" data-erro role="alert"></p>
    <button class="btn btn-sinal" type="submit">${rotulo}</button>
  </form>`;
}

const VIEWS = {
  moto: {
    corridas: () => `<div data-live="mb-status"></div><div data-live="mb-meta"></div><div data-live="mb-main" class="cascata"></div>`,
    ganhos: () => `<div data-live="mb-ganhos" class="cascata"></div>`,
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
      return `${cartaoInstalar()}<form class="bloco" data-form="perfil" novalidate>
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
      </form>
      ${p.nome ? `<section class="bloco"><h2>Divulgue seu trabalho</h2><p class="sub mb14">Mande seu cartão pras lojas do bairro: nome, moto, placa e quantas entregas você já fez.</p>
        <button class="btn btn-azul" data-act="cartao">${ic('balao')}Compartilhar meu cartão</button></section>` : ''}`;
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
        ${campo('localCliente', 'Localização do cliente (opcional)', rs.localCliente || '', 'text', `placeholder="Cole o link da localização que ele mandou…" maxlength="300" autocomplete="off" spellcheck="false" aria-describedby="geo-cli"`)}
        <small id="geo-cli" class="mudo dica" data-geo-cliente>Com o link, o app calcula a distância e o motoboy vai direto no ponto certo.</small>
        <div class="grade2">
          ${campo('cliente', 'Cliente', rs.cliente || '', 'text', `placeholder="Ex.: Ana" maxlength="${LIMITES.nome}" autocomplete="off"`)}
          ${campo('telCliente', 'WhatsApp do cliente', rs.telCliente || '', 'tel', `placeholder="(31) 9…" inputmode="tel" maxlength="${LIMITES.tel}" autocomplete="off"`)}
        </div>
        <label class="campo"><span>Observação pro motoboy</span><textarea class="inp" name="obs" maxlength="${LIMITES.obs}" placeholder="Ex.: pedido grande, levar bag térmica, troco pra R$ 50…" aria-describedby="obs-dica">${esc(rs.obs || '')}</textarea></label>
        <small id="obs-dica" class="mudo dica">Os motoboys leem isso antes de aceitar. Não coloque nome, telefone ou endereço do cliente aqui.</small>
        <div class="campo"><span id="pg-rot">Pagamento do cliente</span>
          <div class="raio" role="radiogroup" aria-labelledby="pg-rot">${[['pago', 'Já pago'], ['dinheiro', 'Dinheiro'], ['maquininha', 'Maquininha']].map(([v, n]) =>
            `<button type="button" role="radio" data-act="cobranca" data-v="${v}" aria-checked="${(rs.cobranca || 'pago') === v}">${n}</button>`).join('')}</div>
          <input type="hidden" name="cobranca" value="${esc(rs.cobranca || 'pago')}">
        </div>
        <div class="grade2" data-cobrar ${(rs.cobranca || 'pago') === 'pago' ? 'hidden' : ''}>
          ${campo('cobrar', 'Valor a cobrar (R$)', rs.cobrar || '', 'number', 'step="0.01" min="0" max="5000" inputmode="decimal" placeholder="Ex.: 37,50"')}
          <div data-troco ${(rs.cobranca || 'pago') !== 'dinheiro' ? 'hidden' : ''}>${campo('troco', 'Troco pra (R$)', rs.troco || '', 'number', 'step="1" min="0" max="5000" inputmode="decimal" placeholder="Ex.: 50"')}</div>
        </div>
        <label class="check"><input type="checkbox" name="volta" ${rs.volta ? 'checked' : ''}> O motoboy volta pra loja depois (maquininha, troco ou devolução). Ele recebe +50% do frete.</label>
        <label class="check"><input type="checkbox" name="chuva"> Está chovendo (+${brl(TABELA.chuva)} pro motoboy)</label>
        ${S().empresa.favoritos.length ? (PLANOS[S().empresa.plano].favoritos
          ? `<label class="check"><input type="checkbox" name="soFavoritos" checked> Oferecer primeiro ${S().empresa.favoritos.length === 1 ? 'ao meu motoboy favorito' : `aos meus ${S().empresa.favoritos.length} motoboys favoritos`} (30 segundos)</label>`
          : `<p class="aviso">Chamar primeiro os seus motoboys favoritos é dos planos Loja e Pro. <button type="button" class="link" data-act="aba" data-aba="loja">Ver planos</button></p>`) : ''}
        <div class="campo"><span id="raio-rot">Buscar motoboy a até</span>
          <div class="raio" role="radiogroup" aria-labelledby="raio-rot">${RAIOS_BUSCA.map(n =>
            `<button type="button" role="radio" data-act="raioBusca" data-r="${n}" aria-checked="${S().empresa.raioBusca === n}">${n} km</button>`).join('')}</div>
          <small class="mudo dica">O chamado toca primeiro pra quem está a 2 km da loja, e o raio cresce a cada 30 s até esse limite.</small>
        </div>
        <div data-live="em-perto"></div>
        <div data-live="em-preco"></div>
        <p class="erro" data-erro role="alert"></p>
        <button class="btn btn-sinal" type="submit" data-cta>Chamar motoboy</button>
      </form>
      <div data-live="em-rep"></div>`;
    },
    chamados: () => `<div data-live="em-lista"></div>`,
    loja: () => `${cartaoInstalar()}${formEmpresa('Dados da empresa', '', 'Salvar dados')}
      <section class="bloco"><h2>Como funciona o preço</h2>
        <div class="linha"><span>Até ${TABELA.kmInclusos} km</span><b>${brl(TABELA.base)}</b></div>
        <div class="linha"><span>Cada km a mais</span><b>${brl(TABELA.porKm)}</b></div>
        <div class="linha"><span>Chuva</span><b>+${brl(TABELA.chuva)}</b></div>
        <div class="linha"><span>Espera acima de ${TABELA.esperaGratisMin} min</span><b>${brl(TABELA.esperaPorMin)}/min</b></div>
        <div class="linha"><span>Cancelar depois do aceite</span><b>${brl(TABELA.deslocamentoCancelado)}</b></div>
        <div class="linha"><span>Taxa do app (plano ${PLANOS[S().empresa.plano].nome})</span><b>${taxaAgora() ? brl(taxaAgora()) + ' por chamado' : 'incluída no plano'}</b></div>
        <p class="sub mt8">O frete vai inteiro pro motoboy. Deixar o pedido pronto antes de chamar evita taxa de espera e melhora sua nota com os motoboys.</p>
      </section>
      <div data-live="em-planos"></div>`
  }
};

/* ============ Partes vivas ============ */
let oferta = { id: null, ate: 0 };
let ultimaAtiva = null;
let avaliacao = { id: null, nota: 0, tags: [] };

const LIVE = {
  'nuvem-status': el => {
    if (!nuvem.nuvemLigada()) { html(el, '<small class="servidor">Modo demonstração</small>'); return; }
    const { estado, detalheErro } = nuvem.estadoNuvem();
    const t = { conectado: 'Online no servidor', conectando: 'Conectando…', erro: detalheErro || 'Sem servidor', desligado: '' }[estado];
    html(el, t ? `<small class="servidor servidor-${estado}">${esc(t)}</small>` : '');
  },
  'mb-status': el => {
    const s = S();
    html(el, `<div class="status ${s.online && !emPausa() ? 'on' : ''}">
      <button class="chave" role="switch" aria-checked="${s.online}" aria-label="Receber chamados" data-act="online"></button>
      <div class="txt">${emPausa()
        ? `<b>Em pausa</b><small>Volta em <span class="num" data-ate="${s.pausaAte}">--:--</span>. Água, alongamento, respira.</small>`
        : s.online
          ? `<b>Online</b><small>Recebendo chamados há <span class="num" data-desde="${s.onlineDesde}">--:--</span></small>`
          : `<b>Offline</b><small>Liga a chave pra receber chamados</small>`}
        ${s.online ? (() => {
          const g = estadoGps(), pos = posicaoAtual();
          const t = { ligado: `GPS ligado${pos ? `, precisão de ${pos.precisao} m` : ''}`, pedindo: 'Ligando o GPS…', negado: 'GPS bloqueado. Libere a localização pro app no navegador.', 'sem-gps': 'GPS indisponível agora.', desligado: 'GPS desligado.' }[g];
          return `<small class="gps gps-${g}">${t}</small>`;
        })() : ''}</div></div>
      ${s.online ? `<div class="raio" role="group" aria-label="Raio de atuação: até quantos km você vai buscar">
        <span>Buscar até</span>${RAIOS_MOTOBOY.map(n => `<button type="button" data-act="raio" data-r="${n}" aria-pressed="${s.profile.raio === n}">${n} km</button>`).join('')}</div>` : ''}`);
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
    html(el, `<div class="radar ${livre ? '' : 'parado'}" data-tela="radar-${livre}"><div class="onda">${ic('moto')}</div></div>
      <div class="vazio colado">${livre
        ? `<b>Procurando chamados a até ${S().profile.raio} km de você</b>${posicaoAtual()
            ? 'Quando uma loja perto chamar, o valor aparece aqui antes de você decidir.'
            : 'Sem GPS agora: você vê os chamados da cidade toda. Com o GPS ligado, só os do seu raio.'}`
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
    html(el, `<section class="saldo" data-3d="7" data-tela="ganhos">
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
    const rodado = r2(s.calls.filter(c => c.motoboy && c.status === 'entregue' && (c.entregueEm || 0) > p.oleoDesde).reduce((a, c) => a + kmCorrida(c), 0));
    const feitos = s.checklist.dia === hojeTxt() ? s.checklist.itens : [];
    const pct = Math.min(100, rodado / p.oleoCada * 100), falta = Math.max(0, p.oleoCada - rodado);
    const tempo = s.online && s.onlineDesde ? (Date.now() - s.onlineDesde) / 60000 : 0;
    html(el, `${tempo >= 120 ? `<div class="aviso">Você está online há ${Math.floor(tempo / 60)}h${String(Math.floor(tempo % 60)).padStart(2, '0')}. Uma pausa de 15 min reduz o cansaço no trânsito. <button class="link" data-act="pausa">Pausar agora</button></div>` : ''}
      <section class="bloco meta"><h2>Manutenção da moto</h2>
        <div class="topo"><span>Óleo: <b class="num">${km(rodado)} km</b> rodados</span><small class="mudo">troca a cada ${km(p.oleoCada)} km</small></div>
        <div class="barra"><i data-w="${pct}" class="${pct >= 90 ? 'alerta' : ''}"></i></div>
        <p class="sub mt8">${falta > 0 ? `Faltam ${km(falta)} km pra próxima troca.` : 'Passou da hora de trocar o óleo.'} Conta os km das entregas feitas no app (medidos pelo GPS quando ele está ligado).</p>
        <button class="btn btn-fantasma btn-sm mt10" data-act="oleo">Troquei o óleo hoje</button>
      </section>
      <section class="bloco"><h2>Antes de sair: ${feitos.length} de ${CHECKLIST.length}</h2>
        <div class="chips" role="group" aria-label="Checklist da moto">${CHECKLIST.map((t, i) => `<button type="button" data-act="checar" data-i="${i}" aria-pressed="${feitos.includes(i)}">${esc(t)}</button>`).join('')}</div>
        <p class="sub">${feitos.length === CHECKLIST.length ? 'Tudo conferido. Boa rodada!' : 'Dois minutos de conferência evitam a maioria das quedas e multas. Zera todo dia.'}</p>
      </section>`);
  },
  'em-preco': el => {
    const f = $('[data-form="chamado"]'); if (!f) return;
    const kmV = numero(f.km.value, LIMITES.kmMin, LIMITES.kmMax, 0);
    const v = frete(kmV, f.chuva.checked, f.volta.checked), taxa = taxaAgora();
    html(el, `<div class="preco">
      <div class="linha"><span>Frete (vai inteiro pro motoboy)</span><b>${brl(v)}</b></div>
      ${f.volta.checked ? `<div class="linha"><span>Já inclui a volta à loja</span><b>+${brl(v - frete(kmV, f.chuva.checked))}</b></div>` : ''}
      <div class="linha"><span>Taxa do app (plano ${PLANOS[S().empresa.plano].nome})</span><b>${taxa ? brl(taxa) : 'incluída'}</b></div>
      <div class="total"><span>Você paga</span><b>${brl(v + taxa)}</b></div>
    </div>`);
    const cta = $('[data-cta]'); if (cta) cta.textContent = `Chamar motoboy por ${brl(v + taxa)}`;
  },
  'em-perto': el => {
    if (!el) return;
    const loja = S().empresa.geo, raio = S().empresa.raioBusca;
    if (!nuvem.nuvemLigada()) { html(el, ''); return; }
    if (!loja) { html(el, `<div class="perto">${ic('nav')}<span>Salve a localização da loja na aba Empresa pra ver quantos motoboys estão perto.</span></div>`); return; }
    const n = disponiveisNoRaio(nuvem.disponiveisAgora(), loja, raio);
    html(el, `<div class="perto ${n ? 'tem' : ''}">${ic('moto')}<span>${n
      ? `<b>${n} ${n === 1 ? 'motoboy livre' : 'motoboys livres'}</b> a até ${raio} km da loja agora.`
      : `Nenhum motoboy livre a até ${raio} km agora. Pode chamar assim mesmo: quem ficar online recebe.`}</span></div>`);
  },
  'em-planos': el => {
    const atual = S().empresa.plano, n = feitosNoMes(), custos = custoPlanos(Math.max(n, 1));
    const melhor = Object.entries(custos).sort((a, b) => a[1] - b[1])[0][0];
    html(el, `<section class="bloco"><h2>Planos</h2>
      <p class="sub mb14">Quem paga o app é a empresa. O motoboy não paga nada e fica com 100% do frete.</p>
      ${Object.entries(PLANOS).map(([k, p]) => `<article class="plano ${k === atual ? 'atual' : ''}">
        <div class="plano-cab"><b>${p.nome}</b>${k === atual ? '<span class="pill entregue">Seu plano</span>' : ''}</div>
        <div class="plano-preco"><b class="num">${p.mensal ? brl(p.mensal) : brl(p.taxa)}</b><small>${p.mensal ? 'por mês' : 'por chamado'}</small></div>
        <p class="sub">${p.resumo}</p>
        ${k === atual ? '' : `<button class="btn btn-sm ${k === 'loja' ? 'btn-sinal' : 'btn-fantasma'} mt10" data-act="plano" data-p="${k}">Mudar pro ${p.nome}</button>`}
      </article>`).join('')}
      <div class="aviso">Este mês você fez <b>${n}</b> ${n === 1 ? 'chamado' : 'chamados'}. Nesse ritmo: Avulso ${brl(custos.avulso)}, Loja ${brl(custos.loja)}, Pro ${brl(custos.pro)}. O que sai mais barato pra você: <b>${PLANOS[melhor].nome}</b>.</div>
      <p class="sub">Por enquanto a escolha do plano só muda os valores mostrados. A cobrança entra quando o app tiver pagamento online.</p>
    </section>`);
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
        ${c.status === 'aberto' && c.lojaGeo ? `<div class="rastreio">${ic('moto')}<span>Procurando motoboy a até <b class="num" data-onda="${c.criadoEm}|${c.prioridadeAte || 0}|${c.raioKm}">${raioOnda(c)}</b> km da loja</span></div>` : ''}
        ${ATIVOS.includes(c.status) && c.motoboy ? mapaCorrida(c, FASE_MAPA[c.status], posDoMotoboy(c)) : ''}
        ${rastreio(c)}
        ${c.status === 'coletado' && c.tentativas ? `<div class="aviso ${c.tentativas >= LIMITES.tentativasCodigo ? 'freio' : ''}">${c.tentativas >= LIMITES.tentativasCodigo
          ? `O motoboy errou o código ${c.tentativas} vezes e a entrega travou. Ligue pra ele ou pro cliente, confira o código e libere.`
          : `O motoboy digitou um código errado ${c.tentativas === 1 ? '1 vez' : `${c.tentativas} vezes`}.`}</div>
          ${c.tentativas >= LIMITES.tentativasCodigo ? `<button class="btn btn-sinal btn-sm mt8" data-act="liberarCodigo" data-id="${esc(c.id)}">Liberar novas tentativas</button>` : ''}` : ''}
        ${c.status === 'coleta' ? `<div class="aviso">${c.chegadaGps ? 'Chegada confirmada pelo GPS. ' : ''}Esperando há <b class="num" data-desde="${c.chegouEm}">--:--</b>. Depois de ${TABELA.esperaGratisMin} min, a espera custa ${brl(TABELA.esperaPorMin)}/min.</div>` : ''}
        ${textoCobranca(c, false) || c.volta ? `<div class="mudo pq mt6">${[textoCobranca(c, false), c.volta ? 'Motoboy volta pra loja.' : ''].filter(Boolean).join(' ')}</div>` : ''}
        ${emAndamento ? `<div class="mt8"><small class="mudo">Código de entrega (passe só pro cliente)</small><div class="codigo">${c.codigo}</div></div>
          <a class="btn btn-ok btn-sm mt10" href="${esc(linkCliente(c))}" target="_blank" rel="noopener noreferrer">${ic('balao')}Mandar código e mapa pro cliente</a>
          ${linkMapaCliente(c) ? `<button class="btn btn-fantasma btn-sm mt8" data-act="copiarRastreio" data-id="${esc(c.id)}">${ic('mapa')}Copiar link do mapa</button>` : ''}` : ''}
        ${c.status === 'entregue' ? `<div class="mudo pq mt6">Frete ${brl(c.valor)}${c.espera ? ` + espera ${brl(c.espera)}` : ''}${c.gorjeta ? ` + gorjeta ${brl(c.gorjeta)}` : ''}${c.kmReal ? `. Rodou ${km(c.kmReal)} km (GPS)` : ''}</div>
          ${c.motoboy ? (() => { const fav = S().empresa.favoritos.includes(c.motoboy); return `<button class="btn btn-sm ${fav ? 'btn-sinal' : 'btn-fantasma'} mt10" data-act="favoritar" data-nome="${esc(c.motoboy)}" data-uid="${esc(c.motoboyUid)}" aria-pressed="${fav}">${ic('estrela')}${fav ? `${esc(c.motoboy)} é seu favorito` : `Favoritar ${esc(c.motoboy)}`}</button>`; })() : ''}
          ${c.gorjeta ? '' : `<div class="acoes acoes3">${LIMITES.gorjetas.map(v => `<button class="btn btn-fantasma btn-sm" data-act="gorjeta" data-id="${esc(c.id)}" data-v="${v}">+${brl(v)}</button>`).join('')}</div><small class="mudo">Mandar gorjeta pro motoboy</small>`}` : ''}
        ${c.status === 'cancelado' && c.compensacao ? `<div class="mudo pq mt6">Deslocamento pago ao motoboy: ${brl(c.compensacao)}</div>` : ''}
        ${!emAndamento ? `<button class="btn btn-fantasma btn-sm mt10" data-act="repetir" data-id="${esc(c.id)}">${ic('repetir')}Chamar de novo</button>` : ''}
        ${podeIr(c.status, 'cancelado') ? `<button class="btn btn-fantasma btn-sm mt10" data-act="cancelar" data-id="${esc(c.id)}">Cancelar chamado</button>` : ''}
      </article>`;
    }).join(''));
  }
};

// Onde está o motoboy agora, visto pela empresa (nesta versão, entre abas do mesmo aparelho).
const posDoMotoboy = c => (c.posMotoboy && Date.now() - c.posMotoboy.em < 120000 ? c.posMotoboy : (c.nuvem ? null : posicaoAtual()));
function rastreio(c) {
  const pos = posDoMotoboy(c);
  if (!pos || !['aceito', 'coletado'].includes(c.status)) return '';
  const alvo = c.status === 'aceito' ? c.lojaGeo : c.clienteGeo;
  if (!alvo) return `<div class="rastreio">${ic('nav')}<span>${esc(c.motoboy)} está com o GPS ligado. Salve a localização ${c.status === 'aceito' ? 'da loja' : 'do cliente'} pra ver a distância.</span></div>`;
  if (c.status === 'coletado' && perto(pos, alvo, RAIO_CLIENTE_M)) return `<div class="rastreio chegando">${ic('nav')}<span><b>${esc(c.motoboy)}</b> está chegando no cliente.</span></div>`;
  const f = faltaAte(c, pos, alvo);
  return `<div class="rastreio">${ic('nav')}<span><b>${esc(c.motoboy)}</b> está a ${km(f.km)} km ${c.status === 'aceito' ? 'da loja' : 'do cliente'}, chega em ${minTxt(f.min)}.</span></div>`;
}

function telaOferta(c) {
  const r = reputacao(S().calls, c.empresa);
  const porKm = c.valor / c.km;
  const lucro = c.valor - c.km * custoKm(S().profile);
  const resta = Math.max(0, oferta.ate - Date.now());
  const outras = ofertasAbertas().filter(x => x.id !== c.id).slice(0, 4);
  // Como Uber e 99: o tempo da corrida inteira e quanto ela rende por hora, antes de aceitar.
  const est = estimativaCorrida(c, ateLoja(c));
  return `<section class="oferta cascata" data-tela="oferta-${esc(c.id)}">
    <h2 class="vh">Novo chamado</h2>
    <div class="placa" data-3d="8" data-giro>
      <div class="faixa-azul"><span>Novo chamado</span><span>${esc(c.empresa)}</span></div>
      <div class="valor num">${brl(c.valor)}</div>
      <div class="porkm">${brl(porKm)} por km, sobra ${brl(lucro)} depois da gasolina</div>
      <div class="porhora">≈ ${est.min} min no total · <b>${brl(est.porHora)}/hora</b></div>
    </div>
    <div class="bloco mt14">
      ${mapaCorrida(c, 'oferta', posicaoAtual())}
      <ul class="rota">
        <li><b>${esc(c.empresa)}</b><small>${esc(c.coleta)}${ateLoja(c) != null ? `. Você está a ${km(ateLoja(c))} km, uns ${etaMin(ateLoja(c))} min` : ''}</small></li>
        <li><b>${esc(c.entrega)}</b><small>${km(c.km)} km da loja até o cliente${(() => { const r = c.lojaGeo && c.clienteGeo && infoRota(c.id); return r ? `. Pelas ruas: ${km(r.km)} km, ${minTxt(r.min)}` : c.clienteGeo ? ', ponto exato no mapa' : ''; })()}</small></li>
      </ul>
      <div class="rep">
        ${r ? `<span class="tag ${r.nota >= 4 ? 'boa' : r.nota < 3 ? 'ruim' : ''}">★ ${r.nota.toFixed(1).replace('.', ',')} pelos motoboys</span>${r.espera != null ? `<span class="tag ${r.espera > TABELA.esperaGratisMin ? 'ruim' : 'boa'}">espera média ${Math.round(r.espera)} min</span>` : ''}` : '<span class="tag">Empresa ainda sem avaliação</span>'}
        ${c.chuva ? `<span class="tag info">+${brl(TABELA.chuva)} de chuva incluso</span>` : ''}
        ${c.volta ? '<span class="tag info">Volta pra loja (já incluso no valor)</span>' : ''}
        ${avisoCobranca(c) ? `<span class="tag info">${avisoCobranca(c)}</span>` : ''}
        ${c.preferidos.includes(S().profile.nome) ? '<span class="tag boa">Esta loja te favoritou</span>' : ''}
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
      `<button class="item-oferta" data-act="escolher" data-id="${esc(o.id)}"><span>${esc(o.empresa)}<small>${ateLoja(o) != null ? `Loja a ${km(ateLoja(o))} km de você. ` : ''}Entrega de ${km(o.km)} km, ${brl(o.valor / o.km)} por km</small></span><b>${brl(o.valor)}</b></button>`).join('')}</div>` : ''}
  </section>`;
}

function telaCorrida(c) {
  const passo = { aceito: 0, coleta: 1, coletado: 2 }[c.status];
  const naLoja = c.status !== 'coletado';
  const alvo = naLoja ? c.coleta : c.entrega;
  const tel = fone(c.tel);
  const titulo = { aceito: 'Vai até a loja', coleta: 'Esperando o pedido', coletado: 'Leva até o cliente' }[c.status];
  const etapas = ['Indo à loja', 'Na loja', 'Entregando', 'Entregue'];
  const alvoGeo = naLoja ? c.lojaGeo : c.clienteGeo, pos = posicaoAtual();
  const destinoNav = alvoGeo ? coordTxt(alvoGeo) : alvo;
  const falta = c.status !== 'coleta' ? faltaAte(c, pos, alvoGeo) : null;
  return `<ol class="passos" data-tela="corrida-${esc(c.id)}-${c.status}" aria-label="Etapa ${passo + 1} de 4: ${etapas[passo]}">${etapas.map((n, i) =>
      `<li class="${i < passo ? 'feito' : i === passo ? 'agora' : ''}" ${i === passo ? 'aria-current="step"' : ''}>${n}</li>`).join('')}</ol>
    ${mapaCorrida(c, FASE_MAPA[c.status], pos)}
    <section class="bloco">
      <h2 class="sub">${titulo}</h2>
      <p class="destino">${esc(naLoja ? c.empresa : (c.cliente || 'Cliente'))}</p>
      <p class="mudo">${esc(alvo)}</p>
      ${falta ? `<div class="rastreio">${ic('nav')}<span>Faltam uns <b>${km(falta.km)} km</b>, ${falta.min === 1 ? '1 minuto' : `${falta.min} min`}.</span></div>` : ''}
      ${c.status === 'aceito' && c.lojaGeo ? '<p class="sub mt6">Quando você chegar perto da loja, o GPS registra a chegada sozinho e a espera começa a contar.</p>' : ''}
      ${c.status === 'coleta' && c.chegadaGps ? `<span class="tag boa mt6">Chegada registrada pelo GPS às ${hora(c.chegouEm)}</span>` : ''}
      ${c.status === 'coleta' ? `<div class="espera-box"><div class="relogio" data-desde="${c.chegouEm}" role="timer" aria-label="Tempo de espera">--:--</div>
        <p class="sub" data-espera="${esc(c.id)}"></p></div>` : ''}
      ${c.obs && c.status !== 'coleta' ? `<div class="aviso">${esc(c.obs)}</div>` : ''}
      ${textoCobranca(c, true) ? `<div class="aviso cobranca">${ic('carteira')}<span>${textoCobranca(c, true)}</span></div>` : ''}
      ${c.volta ? `<div class="aviso">Depois de entregar, volte à ${esc(c.empresa)}${c.cobranca === 'maquininha' ? ' com a maquininha' : c.cobranca === 'dinheiro' ? ' com o dinheiro' : ''}. A volta já está no seu frete.</div>` : ''}
      <div class="acoes">
        <a class="btn btn-azul btn-sm" href="${esc(mapsUrl(destinoNav))}" target="_blank" rel="noopener noreferrer">${ic('nav')}Google Maps</a>
        <a class="btn btn-azul btn-sm" href="${esc(wazeUrl(destinoNav))}" target="_blank" rel="noopener noreferrer">${ic('nav')}Waze</a>
      </div>
      ${tel ? `<div class="acoes"><a class="btn btn-fantasma btn-sm" href="tel:+${tel}">${ic('fone')}Ligar pra loja</a><a class="btn btn-fantasma btn-sm" href="https://wa.me/${tel}" target="_blank" rel="noopener noreferrer">${ic('balao')}WhatsApp</a></div>` : ''}
    </section>
    <div class="grade2 mb12">
      <div class="mini"><b>${brl(c.valor)}</b><small>frete garantido</small></div>
      <div class="mini"><b>${c.kmReal ? km(c.kmReal) : km(c.km)} km</b><small>${c.kmReal ? 'rodados nesta corrida (GPS)' : 'até o cliente'}</small></div>
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
  return `<section class="bloco centro resumo" data-tela="avaliar-${esc(c.id)}">
    <h2 class="sub">Entrega feita</h2>
    <p class="relogio ganho">+${brl(ganho(c))}</p>
    <p class="sub mb14">${c.espera ? `Inclui ${brl(c.espera)} de espera. ` : ''}Já está no seu saldo.</p>
    <div class="grade3">
      <div class="mini"><b>${brl(c.valor)}</b><small>frete</small></div>
      <div class="mini"><b>${km(kmCorrida(c))} km</b><small>${c.kmReal ? 'rodados (GPS)' : 'estimados'}</small></div>
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

/* ============ GPS ============ */
// Cada leitura boa do GPS vai pro ciclo da corrida (km, posição e chegada automática ficam lá).
function aoPontoGps(ponto, andou) {
  // Não redesenha a tela no meio de um arraste do deslizador; a próxima leitura chega em segundos.
  if (arrasto) return;
  corridas.noGps(ponto, andou).then(r => {
    if (r.chegouNa) { vibrar([60, 40, 60]); toast(`Chegada na ${r.chegouNa} registrada pelo GPS. A espera começou a contar.`); }
    if (r.chegandoCliente) { vibrar([60, 40, 60]); bipe(); toast('Você está chegando no cliente. Já peça o código de entrega.'); }
  });
  // Livre e online: a loja vê que tem motoboy perto (posição aproximada, ~1 km, sem nome).
  if (S().online && !emPausa() && !corridaAtiva()) nuvem.publicarDisponivel(ponto); else nuvem.esquecerDisponivel();
}
function sincronizarGps() {
  if (papel === 'moto' && S().online) ligarGps(aoPontoGps);
  else if (estadoGps() !== 'desligado') desligarGps();
}
aoMudarGps(() => document.querySelectorAll('[data-live="mb-status"]').forEach(el => LIVE['mb-status'](el)));

function refresh() {
  sincronizarGps();
  document.querySelectorAll('[data-live]').forEach(el => LIVE[el.dataset.live]?.(el));
  const b = document.querySelector('[data-badge="corridas"]');
  if (b) b.className = aba !== 'corridas' && (corridaAtiva() || (S().online && ofertaAtual())) ? 'dot' : '';
  const e = document.querySelector('[data-badge="chamados"]');
  if (e) e.className = aba !== 'chamados' && S().calls.some(c => c.empresa === S().empresa.nome && ATIVOS.includes(c.status)) ? 'dot' : '';
  tick();
  montarMapas();
}
aoMudar(refresh);
aoMudarRota(refresh);
ligarEfeitos();

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
  document.querySelectorAll('[data-onda]').forEach(el => {
    const [criadoEm, prioridadeAte, raioKm] = el.dataset.onda.split('|').map(Number);
    el.textContent = String(raioOnda({ criadoEm, prioridadeAte, raioKm }, agora));
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
  // Só redesenha se a tela de corridas está aberta: é ela que marca a oferta (oferta.id).
  // Em outra aba, chamar refresh aqui voltava pro tick e travava o app (laço infinito).
  if (papel === 'moto' && !oferta.id && document.querySelector('[data-live="mb-main"]') && S().online && !emPausa() && !corridaAtiva() && !aAvaliar() && ofertaAtual()) refresh();
  if (S().pausaAte && S().pausaAte <= agora) {
    mudar(s => { s.pausaAte = null; });
    if (papel === 'moto') toast('Pausa encerrada. Você está online de novo.');
  }
}
setInterval(tick, 1000);

/* ============ Ações ============ */

const vibrar = ms => { try { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(ms); } catch {} };

// O ciclo da corrida: chamado do servidor vai pro servidor; chamado de teste fica no aparelho.
const corridas = criarCorridas(armazemMisto(armazemLocal({ S, transacao: mudar }), nuvem.armazemNuvem, nuvem.nuvemLigada));
const MOTIVOS = {
  indisponivel: 'Esse chamado mudou de situação. A tela já mostra como ele está agora.',
  ocupado: 'Termine a corrida atual antes de aceitar outra.',
  invalido: 'Confira os dados e tente de novo.',
  recusado: 'O servidor recusou essa ação. A tela já mostra a situação atual.',
  'sem-conexao': 'Sem conexão com o servidor. Confira a internet e tente de novo.',
  bloqueado: 'Muitas tentativas erradas. Ligue pra loja: ela confere o código com o cliente e libera novas tentativas.'
};
const avisoFalha = r => toast(MOTIVOS[r.motivo] || MOTIVOS.indisponivel);

async function aceitarChamado(id) {
  oferta = { id: null, ate: 0 }; armado = null; escolhida = null;
  const r = await corridas.aceitar(id, S().profile);
  if (r.ok) { nuvem.esquecerDisponivel(); vibrar(30); scrollTo(0, 0); toast('Corrida aceita. Bora!'); return; }
  toast(r.motivo === 'indisponivel' ? 'Outro motoboy aceitou primeiro. Sem problema, o próximo chamado aparece aqui.' : MOTIVOS[r.motivo]);
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
    document.querySelectorAll('[data-act="tema"]').forEach(b => b.setAttribute('aria-checked', String(tema === 'sol')));
    // Sem aviso flutuante: ele cobria o próprio botão. A chavinha já mostra se está ligado; leitor de tela anuncia pelo aria-checked.
  },
  repetir: el => {
    const c = S().calls.find(x => x.id === el.dataset.id); if (!c) return;
    rascunho = { entrega: c.entrega, km: c.km, cliente: c.cliente, telCliente: c.telCliente, obs: c.obs, localCliente: c.clienteGeo ? `${c.clienteGeo.lat},${c.clienteGeo.lon}` : '' };
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
    // Offline apaga a última posição: o app não guarda onde o motoboy está quando ele não está trabalhando.
    if (!ligar) { nuvem.armazemNuvem.esquecerPosicao(); nuvem.esquecerDisponivel(); }
    mudar(s => { s.online = ligar; s.onlineDesde = ligar ? Date.now() : null; s.pausaAte = null; if (ligar) s.recusados = []; else s.posicao = null; });
    toast(ligar ? 'Você está online. O GPS liga só enquanto você estiver online.' : 'Você está offline. GPS desligado. Bom descanso.');
  },
  raio: el => {
    const n = +el.dataset.r;
    if (!RAIOS_MOTOBOY.includes(n)) return;
    mudar(s => { s.profile.raio = n; });
    anunciar(`Raio de ${n} quilômetros.`);
  },
  instalar: async () => {
    const r = await instalar();
    if (r === 'aceitou') toast('Pronto. O Marca aí está na sua tela inicial.');
    else if (r === 'manual') dialogo(passoAPasso());
  },
  simKm: el => {
    const k = +el.dataset.k; if (![2, 4, 6, 8].includes(k)) return;
    el.closest('[role="radiogroup"]')?.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.k === k)));
    const v = $('[data-sim-valor]'), vt = $('[data-sim-volta]');
    if (v) v.textContent = brl(frete(k));
    if (vt) vt.textContent = brl(frete(k, false, true));
  },
  cobranca: el => {
    const v = el.dataset.v; if (!COBRANCAS.includes(v)) return;
    const f = el.closest('form'); if (!f) return;
    f.cobranca.value = v;
    el.closest('[role="radiogroup"]')?.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === v)));
    f.querySelector('[data-cobrar]').hidden = v === 'pago';
    f.querySelector('[data-troco]').hidden = v !== 'dinheiro';
    // Cobrou na maquininha ou em dinheiro: quase sempre o motoboy volta com a maquininha/o dinheiro.
    if (v !== 'pago' && !f.volta.dataset.mexeu) f.volta.checked = true;
    if (v === 'pago' && !f.volta.dataset.mexeu) f.volta.checked = false;
    LIVE['em-preco']($('[data-live="em-preco"]'));
  },
  copiarRastreio: async el => {
    const c = S().calls.find(x => x.id === el.dataset.id); const link = c && linkMapaCliente(c);
    if (!link) return;
    try { await navigator.clipboard.writeText(link); toast('Link do mapa copiado. Cole na conversa com o cliente.'); }
    catch { toast(link); }
  },
  raioBusca: el => {
    const n = +el.dataset.r;
    if (!RAIOS_BUSCA.includes(n)) return;
    mudar(s => { s.empresa.raioBusca = n; });
    el.closest('[role="radiogroup"]')?.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.r === n)));
    LIVE['em-perto']($('[data-live="em-perto"]'));
  },
  pausa: () => {
    nuvem.esquecerDisponivel();
    mudar(s => { s.pausaAte = Date.now() + 15 * 60000; });
    toast('Pausa de 15 min. Nenhum chamado vai tocar.');
    if (aba !== 'corridas') irAba('corridas');
  },
  geoLoja: async el => {
    el.disabled = true;
    const aviso = document.querySelector('[data-geo-loja]');
    if (aviso) aviso.textContent = 'Pegando a localização…';
    try {
      const p = await pegarPosicao();
      mudar(s => { s.empresa.geo = geo(p); });
      const msg = p.precisao > 100 ? `Salva, mas com precisão de ${p.precisao} m. Se puder, tente de novo perto da porta.` : 'Salva. O motoboy recebe a rota exata e o GPS registra a chegada dele.';
      if (aviso) aviso.textContent = msg;
      toast('Localização da loja salva.');
    } catch (e) {
      if (aviso) aviso.textContent = e.message === 'negado' ? 'O navegador bloqueou a localização. Libere nas configurações do site e tente de novo.' : 'Não deu pra pegar a localização agora. Tente de novo em um lugar aberto.';
    } finally { el.disabled = false; }
  },
  plano: el => {
    const k = el.dataset.p;
    if (!Object.hasOwn(PLANOS, k)) return;
    mudar(s => { s.empresa.plano = k; });
    toast(`Plano ${PLANOS[k].nome} escolhido.`);
  },
  favoritar: el => {
    const nome = el.dataset.nome; let agora = false;
    mudar(s => {
      const f = s.empresa.favoritos;
      agora = !f.includes(nome);
      s.empresa.favoritos = agora ? [...f, nome] : f.filter(x => x !== nome);
      const fu = s.empresa.favoritosUid, id = el.dataset.uid;
      if (id) s.empresa.favoritosUid = agora ? [...new Set([...fu, id])] : fu.filter(x => x !== id);
    });
    toast(agora ? `${nome} agora é seu favorito. Seus chamados aparecem primeiro pra ele.` : `${nome} saiu dos favoritos.`);
  },
  checar: el => {
    const i = +el.dataset.i;
    mudar(s => {
      const hoje = hojeTxt();
      const itens = s.checklist.dia === hoje ? s.checklist.itens : [];
      s.checklist = { dia: hoje, itens: itens.includes(i) ? itens.filter(x => x !== i) : [...itens, i] };
    });
  },
  cartao: () => {
    const p = S().profile, n = S().calls.filter(c => c.motoboy && c.status === 'entregue').length;
    const txt = `${p.nome}, motoboy no Marca aí.${p.moto ? ` Moto ${p.moto}` : ''}${p.placa ? `, placa ${p.placa}` : ''}.${n ? ` ${n} entregas feitas pelo app.` : ''} Precisa de entrega? Me chama pelo Marca aí: ${location.origin}${location.pathname}`;
    if (navigator.share) navigator.share({ text: txt }).catch(() => {});
    else location.href = `https://wa.me/?text=${encodeURIComponent(txt)}`;
  },
  maisTempo: () => { if (oferta.id) { oferta.ate += TABELA.maisTempoOferta * 1000; toast(`Mais ${TABELA.maisTempoOferta} segundos pra decidir.`); } },
  simular: () => {
    const lojas = [['Lanchonete Teste', 'Rua de Teste, 100, Centro'], ['Farmácia Teste', 'Av. Exemplo, 250, Centro'], ['Pizzaria Teste', 'Praça Modelo, 12']];
    const [empresa, coleta] = lojas[+novoCodigo() % lojas.length];
    corridas.chamar({ empresa, coleta, entrega: `Rua do Cliente, ${10 + (+novoCodigo() % 900)}, Bairro Teste`, cliente: 'Cliente teste',
      km: r2(1.5 + (+novoCodigo() % 600) / 100), chuva: +novoCodigo() % 10 < 3, teste: true });
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
  cheguei: async el => {
    const c = S().calls.find(x => x.id === el.dataset.id), pos = posicaoAtual();
    // Como Uber/99: "cheguei" longe da loja pede confirmação (a espera só deve contar no balcão).
    if (c?.lojaGeo && pos && !perto(pos, c.lojaGeo, RAIO_CONFERE_CHEGADA_M)) {
      const sim = await confirmar('Você já está na loja?', `O GPS mostra você a uns ${km(kmEstimado(pos, c.lojaGeo))} km da ${c.empresa}. A espera só deve contar quando você estiver no balcão.`, 'Estou na loja', 'Ainda não');
      if (!sim) return;
    }
    const r = await corridas.avancar(el.dataset.id); if (!r.ok) avisoFalha(r);
  },
  coletei: async el => {
    const r = await corridas.avancar(el.dataset.id);
    if (!r.ok) avisoFalha(r);
    else if (r.espera) toast(`Espera de ${brl(r.espera)} somada ao seu ganho.`);
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
      d => d.querySelector('form').addEventListener('submit', async e => {
        e.preventDefault();
        const erro = d.querySelector('#cod-erro'), botao = e.target.querySelector('button');
        botao.disabled = true;
        const r = await corridas.avancar(id, { codigo: String(e.target.cod.value).replace(/\D/g, '') });
        botao.disabled = false;
        if (r.ok) { fecharDialogo(); bipe(); vibrar([40, 60, 40]); scrollTo(0, 0); anunciar('Entrega confirmada.'); return; }
        if (r.motivo === 'indisponivel') { fecharDialogo(); toast(MOTIVOS.indisponivel); return; }
        e.target.cod.setAttribute('aria-invalid', 'true');
        erro.textContent = r.motivo === 'codigo-errado' ? `Código não confere. Confira com o cliente. Restam ${r.restam} tentativas.`
          : r.motivo === 'invalido' ? 'O código tem 4 números.' : MOTIVOS[r.motivo];
      }));
  },
  nota: el => { avaliacao.nota = Math.min(5, Math.max(1, +el.dataset.n)); refresh(); $(`[data-act="nota"][data-n="${avaliacao.nota}"]`)?.focus(); },
  tag: el => {
    const t = el.dataset.t;
    avaliacao.tags = avaliacao.tags.includes(t) ? avaliacao.tags.filter(x => x !== t) : [...avaliacao.tags, t];
    refresh(); $(`[data-act="tag"][data-t="${CSS.escape(t)}"]`)?.focus();
  },
  avaliar: async el => {
    const r = await corridas.avaliar(el.dataset.id, avaliacao.nota, avaliacao.tags);
    if (r.ok) toast('Avaliação enviada. Valeu!'); else avisoFalha(r);
  },
  pularAval: async el => { const r = await corridas.avaliar(el.dataset.id, 0, []); if (!r.ok) avisoFalha(r); },
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
    const r = await corridas.cancelar(id);
    toast(r.ok ? 'Chamado cancelado.' : r.motivo === 'indisponivel' ? 'O motoboy já saiu com o pedido, então não dá mais pra cancelar. Ligue pra ele se precisar.' : MOTIVOS[r.motivo]);
  },
  liberarCodigo: async el => {
    const r = await corridas.liberarCodigo(el.dataset.id);
    if (r.ok) toast('Novas tentativas liberadas. O motoboy já pode digitar o código de novo.'); else avisoFalha(r);
  },
  gorjeta: async el => {
    const c = S().calls.find(x => x.id === el.dataset.id);
    const r = await corridas.gorjeta(el.dataset.id, +el.dataset.v);
    if (r.ok) toast(`Gorjeta de ${brl(+el.dataset.v)} enviada pra ${c?.motoboy || 'o motoboy'}.`); else avisoFalha(r);
  }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled && Object.hasOwn(ACTS, el.dataset.act)) { e.preventDefault(); ACTS[el.dataset.act](el); }
});

/* ============ Formulários ============ */
function lerLocalCliente(f) {
  const aviso = f.querySelector('[data-geo-cliente]');
  const valor = f.localCliente.value.trim();
  if (!valor) { aviso.textContent = 'Com o link, o app calcula a distância e o motoboy vai direto no ponto certo.'; return; }
  const g = extrairGeo(valor);
  if (!g) { aviso.textContent = 'Não achei a localização nesse link. Peça pro cliente mandar a localização pelo WhatsApp e cole aqui.'; return; }
  const loja = S().empresa.geo;
  if (!loja) { aviso.textContent = 'Localização do cliente lida. Salve a localização da loja na aba Empresa pra calcular a distância sozinho.'; return; }
  const d = kmEstimado(loja, g);
  if (d > LIMITES.kmMax) { aviso.textContent = `Esse ponto fica a ${km(d)} km da loja. Confira se o link está certo.`; return; }
  f.km.value = String(d);
  aviso.textContent = `Distância calculada pelo GPS: ${km(d)} km pelas ruas (estimativa).`;
}
const atualizaPreco = e => {
  const f = e.target.closest('[data-form="chamado"]');
  if (!f) return;
  if (e.target.name === 'volta' && e.isTrusted) e.target.dataset.mexeu = '1';
  if (e.target.name === 'localCliente') lerLocalCliente(f);
  LIVE['em-preco']($('[data-live="em-preco"]'));
};
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
    const emp = limparEmpresa({ ...S().empresa, ...d });
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
    const clienteGeo = extrairGeo(d.localCliente);
    const cobranca = COBRANCAS.includes(d.cobranca) ? d.cobranca : 'pago';
    const cobrar = numero(d.cobrar, 0, 5000, 0), troco = numero(d.troco, 0, 5000, 0);
    if (cobranca !== 'pago' && !(cobrar > 0)) return erroForm(f, 'Informe quanto o motoboy deve cobrar do cliente.', 'cobrar');
    if (cobranca === 'dinheiro' && troco > 0 && troco < cobrar) return erroForm(f, 'O "troco pra" precisa ser maior que o valor a cobrar.', 'troco');
    const usarFav = d.soFavoritos === 'on' && PLANOS[S().empresa.plano].favoritos;
    if (nuvem.nuvemLigada() && nuvem.estadoNuvem().estado !== 'conectado') return erroForm(f, nuvem.estadoNuvem().detalheErro || 'Ainda conectando ao servidor. Espere um instante e tente de novo.');
    const botao = f.querySelector('[type="submit"]'); botao.disabled = true;
    corridas.chamar({ empresa: S().empresa.nome, coleta, tel: S().empresa.tel, entrega, cliente: texto(d.cliente, LIMITES.nome), telCliente: texto(d.telCliente, LIMITES.tel),
      km: dist, obs: texto(d.obs, LIMITES.obs), chuva: d.chuva === 'on', volta: d.volta === 'on', cobranca, cobrar, troco, taxa: taxaAgora(), lojaGeo: S().empresa.geo, clienteGeo, raioKm: S().empresa.raioBusca,
      preferidos: usarFav ? S().empresa.favoritos : [], preferidosUid: usarFav ? S().empresa.favoritosUid : [] })
      .then(r => {
        botao.disabled = false;
        if (r.ok) { toast('Chamado enviado. Avisando os motoboys online.'); irAba('chamados'); return; }
        erroForm(f, r.motivo === 'recusado' ? 'O servidor recusou o chamado. Confira os dados e tente de novo.' : MOTIVOS[r.motivo]);
      });
  }
});

// Erros inesperados viram aviso claro, sem expor detalhe técnico na tela.
addEventListener('error', () => toast('Essa tela travou. Feche e abra o app de novo.'));
addEventListener('unhandledrejection', () => toast('Essa tela travou. Feche e abra o app de novo.'));

montar();
if (papel) nuvem.conectar(papel);
nuvem.aoMudarNuvem(() => refresh());
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register(urlScript('sw.js')).catch(() => {});
