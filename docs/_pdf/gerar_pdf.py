# -*- coding: utf-8 -*-
"""PDF de apresentacao da SyncTech, para mandar no WhatsApp.

Os servicos sao lidos de docs/tabela-precos-2026.html, via
extrai_servicos.py -> servicos.json. Ate a versao anterior o gerador
tinha a sua propria copia das descricoes, com uma frase por servico;
duas copias da mesma informacao divergem na primeira mudanca de preco,
e os precos ja mudaram tres vezes nesta sessao. Agora o PDF traz os
itens detalhados que a tabela ja tinha, sem segunda copia.

As fontes vao embutidas em base64 (fontes.css). Sem isso o Chrome
imprime antes de a folha do Google Fonts carregar e o PDF sai com fonte
de sistema.
"""
import io, json, os, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = r'C:\Users\Hashiprod\Desktop\NOVA ERA IA\synctech-automation\docs'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
WPP = '5531986551626'

FONTES = io.open(os.path.join(AQUI, 'fontes.css'), encoding='utf-8').read()
SERVICOS = json.load(io.open(os.path.join(AQUI, 'servicos.json'), encoding='utf-8'))

MENSAIS = [s for s in SERVICOS if not s['unico']]
UNICOS = [s for s in SERVICOS if s['unico']]

PLANOS = [
    ('Starter', 997, 797, 'Para colocar o neg\u00f3cio no ar e parar de perder cliente sem resposta.', False, [
        'Site personalizado, sem valor de entrada', 'Link na Bio para o Instagram',
        'Cat\u00e1logo Digital', 'Agendamento Online', 'WhatsApp Bot 24 horas',
        'Dashboard de M\u00e9tricas', 'Suporte no WhatsApp']),
    ('Neg\u00f3cio', 2597, 2077, 'Para quem j\u00e1 atende bem e quer ser achado, voltar a vender e ser indicado.', True, [
        'Tudo do Starter', 'Instagram Autom\u00e1tico', 'CRM com pipeline de vendas',
        'SEO Local no Google e no Maps', 'Gest\u00e3o de Reputa\u00e7\u00e3o no Google',
        'Controle de Estoque', 'Relat\u00f3rio de Resultados todo m\u00eas', 'Suporte priorit\u00e1rio']),
    ('Pro', 4197, 3357, 'Tudo o que fazemos, inclusive an\u00fancio e aplicativo pr\u00f3prio.', False, [
        'Tudo do Neg\u00f3cio', 'Aplicativo Personalizado', 'Gest\u00e3o de Tr\u00e1fego Pago',
        'Nota Fiscal no pedido', 'Suporte sete dias por semana', 'Reuni\u00e3o mensal de resultados']),
]

# Mecanismo, nao promessa de faturamento: o que passa a acontecer na
# operacao e verificavel; "voce vai faturar X" nao e.
PORQUE = [
    ('Starter', 'Parar de perder quem j\u00e1 estava te procurando',
     'A mensagem que chega \u00e0s 22h espera at\u00e9 voc\u00ea abrir. Quem procura seu neg\u00f3cio no Google n\u00e3o acha um site \u2014 acha o concorrente.',
     'Site no ar, agenda aberta 24 horas e um atendente autom\u00e1tico respondendo na hora, qualquer dia.',
     'O cliente que decidiu \u00e0 noite n\u00e3o esfria at\u00e9 amanh\u00e3.'),
    ('Neg\u00f3cio', 'Ser achado, fazer voltar e ser indicado',
     'Quem pediu pre\u00e7o e n\u00e3o fechou some, e ningu\u00e9m lembra de responder. A nota do Google n\u00e3o sobe porque ningu\u00e9m pede avalia\u00e7\u00e3o.',
     'Cada contato vira um cart\u00e3o que voc\u00ea arrasta at\u00e9 fechar, a avalia\u00e7\u00e3o \u00e9 pedida sozinha depois do atendimento e o perfil do Google \u00e9 trabalhado todo m\u00eas.',
     'Cliente antigo volta, e o novo te acha sem voc\u00ea pagar an\u00fancio.'),
    ('Pro', 'Trazer rosto novo toda semana',
     'O movimento depende de quem passa na porta e de quem j\u00e1 te conhece.',
     'An\u00fancio rodando com teto de custo por cliente calculado a partir do seu ticket e da sua margem, mais um aplicativo pr\u00f3prio na tela do cliente.',
     'Voc\u00ea passa a escolher quanto movimento quer no m\u00eas.'),
]

ECONOMIA = [('Starter', 1288, 997, 291), ('Neg\u00f3cio', 4126, 2597, 1529), ('Pro', 6423, 4197, 2226)]
ENTRADA = 1297

PASSOS = [
    ('Conversa de 30 minutos', 'Voc\u00ea me conta o que faz e onde aperta. Eu digo o que d\u00e1 para automatizar e o que n\u00e3o d\u00e1.'),
    ('Monto tudo para voc\u00ea', 'Voc\u00ea s\u00f3 me passa as informa\u00e7\u00f5es do neg\u00f3cio. A configura\u00e7\u00e3o \u00e9 por minha conta, sem voc\u00ea mexer em nada.'),
    ('No ar em at\u00e9 7 dias', 'Testo com cliente de verdade antes de soltar. A primeira cobran\u00e7a s\u00f3 acontece depois que estiver funcionando.'),
    ('Acompanho todo m\u00eas', 'Ajuste, manuten\u00e7\u00e3o e suporte no WhatsApp, com pessoa de verdade respondendo.'),
]

CONDICOES = [
    ('Pre\u00e7o final', 'O valor \u00e9 o que se paga por m\u00eas. N\u00e3o existe taxa de ades\u00e3o, instala\u00e7\u00e3o nem configura\u00e7\u00e3o cobrada \u00e0 parte.'),
    ('Sem fidelidade', 'Nenhum servi\u00e7o tem prazo m\u00ednimo nem multa. Avise com 15 dias e encerramos.'),
    ('Suas contas, seu nome', 'Google, Meta, emissora de nota: tudo aberto no CNPJ da sua empresa e fica com voc\u00ea.'),
    ('Nunca pedimos senha', 'Sou adicionado como usu\u00e1rio ou administrador, e voc\u00ea remove o acesso quando quiser.'),
]


def brl(n):
    return 'R$ ' + ('{:,.0f}'.format(n)).replace(',', '.')


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


CHECK = ('<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" '
         'stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 8.4l3.4 3.4L13.2 4.8"/></svg>')


def card_plano(nome, mensal, anual, desc, dest, itens):
    return ('<article class="plano%s">%s<h3>%s</h3><p class="pd">%s</p>'
            '<p class="pv">%s<span>/m\u00eas</span></p><p class="pa">ou %s/m\u00eas no plano anual</p>'
            '<ul>%s</ul></article>') % (
        ' dest' if dest else '',
        '<span class="fita">Mais procurado</span>' if dest else '',
        esc(nome), esc(desc), brl(mensal), brl(anual),
        ''.join('<li><i>%s</i>%s</li>' % (CHECK, esc(i)) for i in itens))


def card_servico(s):
    preco = esc(s['valor']).replace('/m\u00eas', '<small>/m\u00eas</small>')
    return ('<article class="sv"><div class="sv-head"><h3>%s%s</h3>'
            '<div class="sv-preco">%s%s</div></div>'
            '<p class="sv-what">%s</p><ul>%s</ul>%s</article>') % (
        esc(s['nome']),
        ' <span class="tag">em implanta\u00e7\u00e3o</span>' if s['soon'] else '',
        preco,
        ('<span>%s</span>' % esc(s['obs'])) if s['obs'] else '',
        esc(s['what']),
        ''.join('<li>%s</li>' % esc(i) for i in s['itens']),
        ('<p class="sv-need">%s</p>' % esc(s['need'])) if s['need'] else '')


def pag_servicos(lista, titulo, eyebrow, sub=None, rodape=None, extra=''):
    tit = ('<div class="tit"><p class="eye">%s</p><h2>%s</h2>%s</div>'
           % (esc(eyebrow), esc(titulo), ('<p>%s</p>' % esc(sub)) if sub else ''))
    return ('<section class="pg">%s%s%s'
            '<div class="rodape"><span>SyncTech Automation \u00b7 Rafael Santos</span><span>%s</span></div>'
            '</section>') % (tit, ''.join(card_servico(s) for s in lista), extra,
                             esc(rodape or '(31) 98655-1626'))


CSS = u"""
%(fontes)s
:root{
  --ink:#140C24; --ink2:#443A5F; --muted:#6E648A;
  --line:#E3DAF4; --lilac:#F3EDFF; --violet:#5B2FB8; --violet2:#7A4BE0;
  --night:#140B28; --night2:#1F1240; --nightline:#3A2866; --glow:#B98BFF;
  --nightink:#EFE7FF; --nightink2:#BCA9E6; --good:#1C6A45;
  --warn:#7A4A12; --warnbg:#FBEEDC;
}
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:Figtree,sans-serif;color:var(--ink);font-size:10pt;line-height:1.45}
h1,h2,h3{font-family:"Bricolage Grotesque",sans-serif;letter-spacing:-.02em;line-height:1.1}
.pg{width:210mm;height:297mm;padding:15mm;position:relative;overflow:hidden;
    page-break-after:always;display:flex;flex-direction:column}
.pg:last-child{page-break-after:auto}

.capa{background:var(--night);color:var(--nightink)}
.capa::after{content:"";position:absolute;right:-30mm;top:-40mm;width:150mm;height:150mm;border-radius:50%%;
  background:radial-gradient(circle, rgba(155,92,255,.34), rgba(155,92,255,0) 68%%)}
.capa>*{position:relative;z-index:1}
.marca{display:flex;align-items:center;gap:4mm}
.marca .dot{width:13mm;height:13mm;border-radius:3.4mm;background:var(--glow);color:var(--night);
  display:flex;align-items:center;justify-content:center;font-family:"Bricolage Grotesque";font-weight:800;font-size:20pt}
.marca b{font-family:"Bricolage Grotesque";font-weight:800;font-size:13pt;display:block}
.marca span{color:var(--nightink2);font-size:9pt}
.capa h1{font-size:33pt;font-weight:800;margin-top:auto;max-width:15em}
.capa h1 em{font-style:normal;color:var(--glow)}
.capa .sub{color:var(--nightink2);font-size:12pt;margin-top:6mm;max-width:28em;line-height:1.55}
.selos{display:flex;gap:3mm;margin-top:8mm;flex-wrap:wrap}
.selos span{border:.4mm solid var(--nightline);border-radius:30mm;padding:2.2mm 5mm;font-size:9.5pt;font-weight:600}
.resumo{display:flex;margin-top:10mm;border:.4mm solid var(--nightline);border-radius:5mm;overflow:hidden}
.resumo div{flex:1;padding:6mm 5mm;background:var(--night2)}
.resumo div+div{border-left:.4mm solid var(--nightline)}
.resumo .n{font-family:"Bricolage Grotesque";font-size:12pt;font-weight:800;color:var(--glow)}
.resumo .v{font-family:"Bricolage Grotesque";font-size:21pt;font-weight:800;margin-top:1.5mm}
.resumo .k{font-size:8.6pt;color:var(--nightink2);margin-top:1.5mm;line-height:1.4}
.capa .pe{margin-top:auto;padding-top:8mm;border-top:.4mm solid var(--nightline);
  display:flex;justify-content:space-between;align-items:flex-end;gap:6mm}
.capa .pe .zap{font-family:"Bricolage Grotesque";font-size:15pt;font-weight:800;color:var(--glow)}
.capa .pe .q{font-size:9pt;color:var(--nightink2);margin-top:1mm}
.capa .pe .dt{font-size:8.6pt;color:var(--nightink2);text-align:right}

.tit{margin-bottom:5mm}
.tit .eye{font-size:8.2pt;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--violet2);margin-bottom:2mm}
.tit h2{font-size:20pt;font-weight:800}
.tit p{color:var(--muted);font-size:9.8pt;margin-top:1.5mm;max-width:34em}
.rodape{margin-top:auto;padding-top:4mm;border-top:.35mm solid var(--line);
  display:flex;justify-content:space-between;color:var(--muted);font-size:8.2pt}

.planos{display:flex;flex-direction:column;gap:3mm}
.plano{border:.4mm solid var(--line);border-radius:4.5mm;padding:5mm 6.5mm;position:relative;background:#fff}
.plano.dest{border:.8mm solid var(--violet);background:var(--lilac)}
.fita{position:absolute;top:-2.6mm;left:7mm;background:var(--violet);color:#fff;font-size:7.6pt;font-weight:700;
  letter-spacing:.08em;text-transform:uppercase;padding:1mm 3.5mm;border-radius:20mm}
.plano h3{font-size:15pt;font-weight:800;display:inline-block}
.plano .pd{color:var(--muted);font-size:9.2pt;margin-top:1.2mm}
.plano .pv{font-family:"Bricolage Grotesque";font-size:23pt;font-weight:800;color:var(--violet);margin-top:2.4mm;line-height:1}
.plano .pv span{font-size:10pt;font-weight:600;color:var(--muted)}
.plano .pa{font-size:8.8pt;color:var(--muted);margin-top:1mm}
.plano ul{list-style:none;margin-top:3.2mm;display:flex;flex-wrap:wrap;gap:1.3mm 5mm}
.plano li{font-size:9.2pt;color:var(--ink2);display:flex;align-items:flex-start;gap:2mm;width:calc(50%% - 2.5mm)}
.plano li i{flex:none;width:3.4mm;height:3.4mm;margin-top:.9mm;color:var(--violet)}
.plano li i svg{width:100%%;height:100%%;display:block}
.aviso{margin-top:3.5mm;background:var(--lilac);border-radius:3.5mm;padding:3.5mm 5mm;font-size:9.2pt;color:var(--ink2)}
.aviso b{color:var(--ink)}

.sv{border:.35mm solid var(--line);border-radius:4mm;padding:4.2mm 5.5mm;margin-bottom:2.8mm}
.sv-head{display:flex;align-items:flex-start;justify-content:space-between;gap:6mm}
.sv h3{font-size:12.5pt;font-weight:700;flex:1}
.tag{font-family:Figtree;font-size:7.4pt;font-weight:700;background:var(--warnbg);color:var(--warn);
  padding:.8mm 2.4mm;border-radius:20mm;vertical-align:middle;margin-left:2mm}
.sv-preco{text-align:right;white-space:nowrap;font-family:"Bricolage Grotesque";font-size:16pt;
  font-weight:800;color:var(--violet);line-height:1}
.sv-preco small{font-size:8.4pt;font-weight:600;color:var(--muted)}
.sv-preco span{display:block;font-family:Figtree;font-size:8pt;font-weight:500;color:var(--muted);margin-top:1mm}
.sv-what{font-size:9.6pt;color:var(--ink2);margin-top:2mm}
.sv ul{list-style:none;margin-top:2.5mm;display:flex;flex-wrap:wrap;gap:1.2mm 5mm}
.sv li{font-size:9pt;color:var(--ink2);width:calc(50%% - 2.5mm);padding-left:3.2mm;position:relative;line-height:1.4}
.sv li::before{content:"";position:absolute;left:0;top:1.6mm;width:1.4mm;height:1.4mm;border-radius:50%%;background:var(--violet2)}
.sub2{font-family:"Bricolage Grotesque";font-size:12pt;font-weight:800;margin:5mm 0 2.5mm}
.sub2 span{font-family:Figtree;font-size:8.8pt;font-weight:500;color:var(--muted);display:block;margin-top:.8mm}
.sv-need{margin-top:2.5mm;background:var(--warnbg);color:var(--warn);border-radius:2.6mm;padding:2.4mm 3.4mm;font-size:8.6pt;line-height:1.4}

.pq{display:flex;flex-direction:column;gap:3.2mm}
.pqc{border:.35mm solid var(--line);border-radius:4mm;padding:4.5mm 5.5mm}
.pqc .pl{font-size:8.2pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--violet2)}
.pqc h3{font-size:13pt;font-weight:800;margin-top:1.2mm}
.pqc .par{display:flex;gap:6mm;margin-top:3mm}
.pqc .par>div{flex:1}
.pqc .rot{font-size:7.8pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:1mm}
.pqc .rot.b{color:var(--violet2)}
.pqc p.t{font-size:9.2pt;color:var(--ink2);line-height:1.45}
.pqc .muda{margin-top:3mm;background:var(--lilac);border-radius:2.6mm;padding:2.6mm 3.6mm;font-size:9.4pt;font-weight:600}

.conta{margin-top:4mm;border:.35mm solid var(--line);border-radius:4mm;overflow:hidden}
.conta .ch{background:var(--lilac);padding:3.4mm 5mm}
.conta .ch b{font-family:"Bricolage Grotesque";font-size:11pt}
.conta .ch p{font-size:8.6pt;color:var(--ink2);margin-top:.8mm}
.conta .lin{display:flex;align-items:center;gap:5mm;padding:3.2mm 5mm;border-top:.3mm solid var(--line)}
.conta .lin .pn{font-family:"Bricolage Grotesque";font-weight:800;font-size:10.5pt;width:20mm}
.conta .lin .av{flex:1;font-size:9pt;color:var(--muted)}
.conta .lin .pr{text-align:right}
.conta .lin .pr b{font-family:"Bricolage Grotesque";font-size:13pt;font-weight:800;color:var(--violet)}
.conta .lin .pr i{display:block;font-style:normal;font-size:8.4pt;font-weight:700;color:var(--good);margin-top:.6mm}
.conta .fim{padding:3mm 5mm;border-top:.3mm solid var(--line);font-size:8.4pt;color:var(--muted);line-height:1.45}

.passos{display:flex;flex-direction:column;gap:2.6mm}
.passo{display:flex;gap:4.5mm;align-items:flex-start;border:.35mm solid var(--line);border-radius:4mm;padding:4mm 5.5mm}
.passo .n{flex:none;width:9mm;height:9mm;border-radius:2.6mm;background:var(--violet);color:#fff;
  display:flex;align-items:center;justify-content:center;font-family:"Bricolage Grotesque";font-weight:800;font-size:12pt}
.passo b{font-family:"Bricolage Grotesque";font-size:11.5pt;font-weight:700;display:block;margin-bottom:1mm}
.passo p{font-size:9.6pt;color:var(--ink2)}
.cond{display:flex;flex-wrap:wrap;gap:3mm;margin-top:5mm}
.cond div{width:calc(50%% - 1.5mm);background:var(--lilac);border-radius:4mm;padding:4.2mm 4.6mm}
.cond b{font-family:"Bricolage Grotesque";font-size:10.6pt;display:block;margin-bottom:1mm}
.cond p{font-size:9.2pt;color:var(--ink2);line-height:1.45}
.cta{margin-top:5mm;background:var(--night);color:var(--nightink);border-radius:5mm;padding:6.5mm;text-align:center}
.cta h3{font-size:16pt;font-weight:800;color:#fff}
.cta p{color:var(--nightink2);font-size:10.2pt;margin-top:2.5mm}
.cta .zap{display:inline-block;margin-top:5mm;background:var(--glow);color:var(--night);
  font-family:"Bricolage Grotesque";font-size:15pt;font-weight:800;padding:3.5mm 9mm;border-radius:30mm}
.cta .q{font-size:8.8pt;color:var(--nightink2);margin-top:3mm}
"""

# Indices de MENSAIS por pagina, definidos pela altura medida de cada
# card (ver empacota.py). Mexer na descricao de um servico muda a altura
# dele: conferir o transbordo depois.
GRUPOS = [[0, 1, 2], [3, 4, 5, 6], [7, 8, 9, 10], [11, 12]]


def montar():
    resumo = ''.join(
        '<div><p class="n">%s</p><p class="v">%s</p><p class="k">por m\u00eas%s</p></div>'
        % (esc(n), brl(m), ', pre\u00e7o final' if i == 0 else '')
        for i, (n, m, a, d, dest, it) in enumerate(PLANOS))

    pq = ''.join(
        '<article class="pqc"><p class="pl">%s</p><h3>%s</h3>'
        '<div class="par"><div><p class="rot">Como \u00e9 hoje</p><p class="t">%s</p></div>'
        '<div><p class="rot b">Com o plano</p><p class="t">%s</p></div></div>'
        '<p class="muda">%s</p></article>'
        % (esc(p), esc(t), esc(a), esc(d), esc(m)) for p, t, a, d, m in PORQUE)

    conta = ''.join(
        '<div class="lin"><span class="pn">%s</span>'
        '<span class="av">avulso daria %s/m\u00eas + %s de entrada</span>'
        '<span class="pr"><b>%s</b><i>guarda %s no primeiro ano</i></span></div>'
        % (esc(n), brl(av), brl(ENTRADA), brl(pl), brl(g * 12 + ENTRADA))
        for n, av, pl, g in ECONOMIA)

    paginas = [
        '<section class="pg capa">'
        '<div class="marca"><div class="dot">S</div><div><b>SyncTech Automation</b>'
        '<span>Automa\u00e7\u00e3o para neg\u00f3cios locais \u00b7 Mariana e Ouro Preto, MG</span></div></div>'
        '<h1>Seu neg\u00f3cio atendendo e vendendo <em>enquanto voc\u00ea trabalha</em></h1>'
        '<p class="sub">Site, atendimento autom\u00e1tico no WhatsApp, agenda, cat\u00e1logo e an\u00fancio \u2014 montados por mim, '
        'prontos em at\u00e9 7 dias. Voc\u00ea n\u00e3o precisa entender nada de tecnologia.</p>'
        '<div class="selos"><span>Pre\u00e7o final, sem taxa de entrada</span><span>Sem fidelidade</span>'
        '<span>No ar em 7 dias</span></div>'
        '<div class="resumo">' + resumo + '</div>'
        '<div class="pe"><div><div class="zap">(31) 98655-1626</div>'
        '<div class="q">Chame no WhatsApp e eu fa\u00e7o um diagn\u00f3stico gratuito do seu neg\u00f3cio.</div></div>'
        '<div class="dt">Rafael Santos<br>Valores v\u00e1lidos a partir de<br>outubro de 2026</div></div>'
        '</section>',

        '<section class="pg">'
        '<div class="tit"><p class="eye">Planos</p><h2>V\u00e1rios servi\u00e7os numa mensalidade s\u00f3</h2>'
        '<p>Sai mais barato do que contratar um por um, e tudo j\u00e1 chega conversando entre si.</p></div>'
        '<div class="planos">' + ''.join(card_plano(*p) for p in PLANOS) + '</div>'
        '<div class="aviso"><b>O site e o Link na Bio entram sem valor de entrada.</b> Contratados separados, '
        'custariam R$ 1.297 s\u00f3 para come\u00e7ar. Em qualquer plano, isso n\u00e3o se paga.</div>'
        '<div class="rodape"><span>SyncTech Automation \u00b7 Rafael Santos</span><span>(31) 98655-1626</span></div>'
        '</section>',

        '<section class="pg">'
        '<div class="tit"><p class="eye">Por que vale a pena</p><h2>O que muda na sua empresa</h2>'
        '<p>O que passa a acontecer no dia a dia \u2014 e, no fim, quanto o plano economiza em dinheiro.</p></div>'
        '<div class="pq">' + pq + '</div>'
        '<div class="conta"><div class="ch"><b>E em dinheiro, quanto o plano economiza</b>'
        '<p>A coluna do meio \u00e9 a soma das mensalidades dos mesmos servi\u00e7os contratados um a um, nas p\u00e1ginas seguintes.</p></div>'
        + conta +
        '<p class="fim">A entrada de R$ 1.297 \u00e9 o Site (R$ 800) e o Link na Bio (R$ 497), que em plano nenhum se paga. '
        'Nenhum servi\u00e7o promete faturamento: o que garantimos \u00e9 a opera\u00e7\u00e3o rodando todo dia \u2014 o resultado depende do seu neg\u00f3cio.</p>'
        '</div>'
        '<div class="rodape"><span>SyncTech Automation \u00b7 Rafael Santos</span><span>(31) 98655-1626</span></div>'
        '</section>',
    ]

    unicos_bloco = (
        '<p class="sub2">Pagamento \u00fanico <span>paga uma vez, \u00e9 seu, sem mensalidade \u2014 '
        'em qualquer plano os dois entram sem valor de entrada</span></p>'
        + ''.join(card_servico(x) for x in UNICOS))

    for i, g in enumerate(GRUPOS):
        ultima = i == len(GRUPOS) - 1
        paginas.append(pag_servicos(
            [MENSAIS[k] for k in g],
            'Prefere contratar s\u00f3 o que precisa?' if i == 0 else 'O que cada servi\u00e7o entrega',
            'Um por um' if i == 0 else 'Um por um \u00b7 continua\u00e7\u00e3o',
            'Pode. Cada servi\u00e7o funciona sozinho, sem plano, e custa o mesmo dentro ou fora de um.' if i == 0 else None,
            None if ultima else 'continua na p\u00e1gina seguinte',
            extra=unicos_bloco if ultima else ''))

    paginas.append(
        '<section class="pg">'
        '<div class="tit"><p class="eye">Como funciona</p><h2>Do primeiro contato ao ar, em 7 dias</h2></div>'
        '<div class="passos">' +
        ''.join('<div class="passo"><div class="n">%d</div><div><b>%s</b><p>%s</p></div></div>'
                % (i + 1, esc(t), esc(d)) for i, (t, d) in enumerate(PASSOS)) +
        '</div><div class="cond">' +
        ''.join('<div><b>%s</b><p>%s</p></div>' % (esc(t), esc(d)) for t, d in CONDICOES) +
        '</div>'
        '<div class="cta"><h3>Vamos ver o que faz sentido pro seu neg\u00f3cio</h3>'
        '<p>Me chame e me conte o que voc\u00ea faz. Eu digo o que d\u00e1 para automatizar hoje, o que n\u00e3o d\u00e1, e quanto fica.</p>'
        '<div class="zap">(31) 98655-1626</div>'
        '<p class="q">Diagn\u00f3stico gratuito, sem compromisso \u00b7 wa.me/' + WPP + '</p></div>'
        '<div class="rodape"><span>SyncTech Automation \u00b7 Mariana/MG</span><span>Outubro de 2026</span></div>'
        '</section>')

    return ('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
            '<title>SyncTech \u2014 Servi\u00e7os e Pre\u00e7os</title><style>' + (CSS % {'fontes': FONTES}) +
            '</style></head><body>' + ''.join(paginas) + '</body></html>')


if __name__ == '__main__':
    html = montar()
    fonte_html = os.path.join(AQUI, 'pdf-fonte.html')
    io.open(fonte_html, 'w', encoding='utf-8', newline='\n').write(html)
    print('HTML montado: %.0f KB | %d paginas de servico' % (len(html.encode('utf-8')) / 1024.0, len(GRUPOS)))

    pdf = os.path.join(SAIDA, 'synctech-servicos-e-precos.pdf')
    cmd = [CHROME, '--headless', '--disable-gpu', '--no-sandbox',
           '--run-all-compositor-stages-before-draw', '--virtual-time-budget=12000',
           '--no-pdf-header-footer', '--print-to-pdf=' + pdf,
           'file:///' + fonte_html.replace('\\', '/')]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if not os.path.exists(pdf):
        print('FALHOU\n', r.stdout, r.stderr)
        sys.exit(1)
    print('PDF: %.0f KB' % (os.path.getsize(pdf) / 1024.0))
