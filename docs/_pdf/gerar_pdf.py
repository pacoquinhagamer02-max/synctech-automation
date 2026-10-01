# -*- coding: utf-8 -*-
"""Monta o PDF de apresentacao e renderiza com o Chrome headless.

Quatro paginas A4, pensadas para serem lidas no celular depois de
chegarem pelo WhatsApp: tipo grande, pouca coisa por pagina, nenhuma
referencia de mercado (isso e argumento interno, nao interessa ao
cliente) e uma frase por servico em vez de lista de recursos.

As fontes vao embutidas em base64 (fontes.css). Sem isso o Chrome
imprime antes da folha do Google Fonts carregar e o PDF sai com fonte
de sistema — ja aconteceu neste projeto.
"""
import io, os, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = r'C:\Users\Hashiprod\Desktop\NOVA ERA IA\synctech-automation\docs'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
WPP = '5531986551626'

FONTES = io.open(os.path.join(AQUI, 'fontes.css'), encoding='utf-8').read()

PLANOS = [
    ('Starter', 997, 797, 'Para colocar o negócio no ar e parar de perder cliente sem resposta.', False, [
        'Site personalizado, sem valor de entrada',
        'Link na Bio para o Instagram',
        'Catálogo Digital',
        'Agendamento Online',
        'WhatsApp Bot 24 horas',
        'Dashboard de Métricas',
        'Suporte no WhatsApp',
    ]),
    ('Negócio', 2597, 2077, 'Para quem já atende bem e quer ser achado, voltar a vender e ser indicado.', True, [
        'Tudo do Starter',
        'Instagram Automático',
        'CRM com pipeline de vendas',
        'SEO Local no Google e no Maps',
        'Gestão de Reputação no Google',
        'Controle de Estoque',
        'Relatório de Resultados todo mês',
        'Suporte prioritário',
    ]),
    ('Pro', 4197, 3357, 'Tudo o que fazemos, inclusive anúncio e aplicativo próprio.', False, [
        'Tudo do Negócio',
        'Aplicativo Personalizado',
        'Gestão de Tráfego Pago',
        'Nota Fiscal no pedido',
        'Suporte sete dias por semana',
        'Reunião mensal de resultados',
    ]),
]

MENSAIS = [
    ('Gestão de Tráfego Pago', 1000, 'Anúncio no Instagram e no Facebook para trazer cliente novo toda semana.', 'a verba do anúncio é sua, paga direto à Meta'),
    ('Aplicativo Personalizado', 1000, 'Seu negócio vira um aplicativo na tela do cliente, com pedido, carrinho e Pix.', ''),
    ('SEO Local no Google', 697, 'Aparecer quando alguém da sua cidade procura o que você vende.', ''),
    ('Gestão de Reputação', 650, 'Cliente satisfeito vira avaliação no Google. Insatisfeito vira conversa privada.', ''),
    ('WhatsApp Bot 24 horas', 500, 'Responde, agenda e confirma sozinho, inclusive domingo e de madrugada.', 'precisa de uma conta Z-API no seu nome'),
    ('Relatório de Resultados', 500, 'Todo mês, uma página com o que foi feito e o que isso deu em número.', ''),
    ('Instagram Automático', 497, 'Comentou no post, recebe mensagem. Começou a seguir, recebe boas-vindas.', ''),
    ('Agendamento Online', 297, 'O cliente marca pelo celular, a qualquer hora, sem falar com ninguém.', ''),
    ('CRM com Pipeline', 297, 'Nenhum cliente se perde: cada pessoa vira um cartão que você arrasta até fechar.', ''),
    ('Nota Fiscal no pedido', 297, 'Cada venda feita pelo aplicativo sai com nota fiscal autorizada.', 'precisa de CNPJ na Sefaz e emissora'),
    ('Catálogo Digital', 247, 'Seu cardápio online com foto e preço. O pedido chega pronto no seu WhatsApp.', ''),
    ('Controle de Estoque', 197, 'Avisa o que está acabando e monta a lista de compras pronta para enviar.', ''),
    ('Dashboard de Métricas', 147, 'Quanto entrou, quantos clientes novos e o que mais vendeu, sem abrir planilha.', ''),
]

UNICOS = [
    ('Site do cliente', 'R$ 800', 'Página própria do negócio: o que você faz, onde fica, horário e WhatsApp sempre à vista.', 'mais R$ 97 por mês de manutenção'),
    ('Link na Bio', 'R$ 497', 'Uma página só sua para o Instagram, com seus serviços, preço e botão de agendar.', 'hospedagem inclusa'),
]

PASSOS = [
    ('Conversa de 30 minutos', 'Você me conta o que faz e onde aperta. Eu digo o que dá para automatizar e o que não dá.'),
    ('Monto tudo para você', 'Você só me passa as informações do negócio. A configuração é por minha conta, sem você mexer em nada.'),
    ('No ar em até 7 dias', 'Testo com cliente de verdade antes de soltar. A primeira cobrança só acontece depois que estiver funcionando.'),
    ('Acompanho todo mês', 'Ajuste, manutenção e suporte no WhatsApp, com pessoa de verdade respondendo.'),
]

CONDICOES = [
    ('Preço final', 'O valor é o que se paga por mês. Não existe taxa de adesão, instalação nem configuração cobrada à parte.'),
    ('Sem fidelidade', 'Nenhum serviço tem prazo mínimo nem multa. Avise com 15 dias e encerramos.'),
    ('Suas contas, seu nome', 'Google, Meta, emissora de nota: tudo aberto no CNPJ da sua empresa e fica com você.'),
    ('Nunca pedimos senha', 'Sou adicionado como usuário ou administrador, e você remove o acesso quando quiser.'),
]


def brl(n):
    return 'R$ ' + ('{:,.0f}'.format(n)).replace(',', '.')


def esc(t):
    return (t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


check = ('<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" '
         'stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 8.4l3.4 3.4L13.2 4.8"/></svg>')


def card_plano(nome, mensal, anual, desc, dest, itens):
    return ('<article class="plano%s">'
            '%s'
            '<h3>%s</h3>'
            '<p class="pd">%s</p>'
            '<p class="pv">%s<span>/mês</span></p>'
            '<p class="pa">ou %s/mês no plano anual</p>'
            '<ul>%s</ul>'
            '</article>') % (
        ' dest' if dest else '',
        '<span class="fita">Mais procurado</span>' if dest else '',
        esc(nome), esc(desc), brl(mensal), brl(anual),
        ''.join('<li><i>%s</i>%s</li>' % (check, esc(i)) for i in itens))


def linha_servico(nome, preco, frase, nota):
    return ('<tr><td class="s"><b>%s</b><span>%s%s</span></td>'
            '<td class="p">%s</td></tr>') % (
        esc(nome), esc(frase),
        ('<em> — %s</em>' % esc(nota)) if nota else '',
        preco if isinstance(preco, str) else brl(preco) + '<small>/mês</small>')


HTML = u"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>SyncTech — Serviços e Preços</title>
<style>
%(fontes)s

:root{
  --ink:#140C24; --ink2:#443A5F; --muted:#6E648A;
  --line:#E3DAF4; --lilac:#F3EDFF; --violet:#5B2FB8; --violet2:#7A4BE0;
  --night:#140B28; --night2:#1F1240; --nightline:#3A2866; --glow:#B98BFF; --nightink:#EFE7FF; --nightink2:#BCA9E6;
}
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:Figtree,sans-serif;color:var(--ink);font-size:10.6pt;line-height:1.5}
h1,h2,h3,.ff{font-family:"Bricolage Grotesque",sans-serif;letter-spacing:-.02em;line-height:1.08}

.pg{width:210mm;height:297mm;padding:17mm 16mm;position:relative;overflow:hidden;page-break-after:always;display:flex;flex-direction:column}
.pg:last-child{page-break-after:auto}

/* ---------- capa ---------- */
.capa{background:var(--night);color:var(--nightink)}
.capa::after{content:"";position:absolute;right:-30mm;top:-40mm;width:150mm;height:150mm;border-radius:50%%;
  background:radial-gradient(circle, rgba(155,92,255,.34), rgba(155,92,255,0) 68%%)}
.capa>*{position:relative;z-index:1}
.marca{display:flex;align-items:center;gap:4mm}
.marca .dot{width:13mm;height:13mm;border-radius:3.4mm;background:var(--glow);color:var(--night);
  display:flex;align-items:center;justify-content:center;font-family:"Bricolage Grotesque";font-weight:800;font-size:20pt}
.marca b{font-family:"Bricolage Grotesque";font-weight:800;font-size:13pt;display:block}
.marca span{color:var(--nightink2);font-size:9pt}

.capa h1{font-size:34pt;font-weight:800;margin-top:auto;max-width:15em}
.capa h1 em{font-style:normal;color:var(--glow)}
.capa .sub{color:var(--nightink2);font-size:12.5pt;margin-top:6mm;max-width:28em;line-height:1.55}

.selos{display:flex;gap:3mm;margin-top:9mm;flex-wrap:wrap}
.selos span{border:.4mm solid var(--nightline);border-radius:30mm;padding:2.2mm 5mm;font-size:9.5pt;font-weight:600}

.resumo{display:flex;gap:0;margin-top:11mm;border:.4mm solid var(--nightline);border-radius:5mm;overflow:hidden}
.resumo div{flex:1;padding:6mm 5mm;background:var(--night2)}
.resumo div + div{border-left:.4mm solid var(--nightline)}
.resumo .n{font-family:"Bricolage Grotesque";font-size:12pt;font-weight:800;color:var(--glow)}
.resumo .v{font-family:"Bricolage Grotesque";font-size:21pt;font-weight:800;margin-top:1.5mm}
.resumo .k{font-size:8.6pt;color:var(--nightink2);margin-top:1.5mm;line-height:1.4}

.capa .pe{margin-top:auto;padding-top:9mm;border-top:.4mm solid var(--nightline);
  display:flex;justify-content:space-between;align-items:flex-end;gap:6mm}
.capa .pe .zap{font-family:"Bricolage Grotesque";font-size:15pt;font-weight:800;color:var(--glow)}
.capa .pe .q{font-size:9pt;color:var(--nightink2);margin-top:1mm}
.capa .pe .dt{font-size:8.6pt;color:var(--nightink2);text-align:right}

/* ---------- comuns ---------- */
.tit{margin-bottom:5.5mm}
.tit .eye{font-size:8.4pt;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--violet2);margin-bottom:2.5mm}
.tit h2{font-size:21pt;font-weight:800}
.tit p{color:var(--muted);font-size:10.2pt;margin-top:2mm;max-width:34em}

.rodape{margin-top:auto;padding-top:5mm;border-top:.35mm solid var(--line);
  display:flex;justify-content:space-between;color:var(--muted);font-size:8.4pt}

/* ---------- planos ---------- */
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

/* ---------- servicos ---------- */
table{width:100%%;border-collapse:collapse}
td{padding:4.2mm 0;border-bottom:.3mm solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}
td.s b{font-family:"Bricolage Grotesque";font-size:10.6pt;font-weight:600;display:block}
td.s span{font-size:9.2pt;color:var(--muted);display:block;margin-top:.6mm;line-height:1.45}
td.s em{font-style:normal;color:var(--violet2)}
td.p{text-align:right;white-space:nowrap;font-family:"Bricolage Grotesque";font-size:12.5pt;font-weight:800;
  color:var(--violet);padding-left:6mm;width:30mm}
td.p small{font-size:8pt;font-weight:600;color:var(--muted)}

.sub2{font-family:"Bricolage Grotesque";font-size:12pt;font-weight:800;margin:7mm 0 2mm}
.sub2 span{font-family:Figtree;font-size:9.2pt;font-weight:500;color:var(--muted);margin-left:2mm}

/* ---------- passos ---------- */
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
</style></head><body>

<!-- ═══ 1 · CAPA ═══ -->
<section class="pg capa">
  <div class="marca">
    <div class="dot">S</div>
    <div><b>SyncTech Automation</b><span>Automação para negócios locais · Mariana e Ouro Preto, MG</span></div>
  </div>

  <h1>Seu negócio atendendo e vendendo <em>enquanto você trabalha</em></h1>
  <p class="sub">Site, atendimento automático no WhatsApp, agenda, catálogo e anúncio — montados por mim, prontos em até 7 dias. Você não precisa entender nada de tecnologia.</p>

  <div class="selos">
    <span>Preço final, sem taxa de entrada</span>
    <span>Sem fidelidade</span>
    <span>No ar em 7 dias</span>
  </div>

  <div class="resumo">%(resumo)s</div>

  <div class="pe">
    <div>
      <div class="zap">(31) 98655-1626</div>
      <div class="q">Chame no WhatsApp e eu faço um diagnóstico gratuito do seu negócio.</div>
    </div>
    <div class="dt">Rafael Santos<br>Valores válidos a partir de<br>outubro de 2026</div>
  </div>
</section>

<!-- ═══ 2 · PLANOS ═══ -->
<section class="pg">
  <div class="tit">
    <p class="eye">Planos</p>
    <h2>Vários serviços numa mensalidade só</h2>
    <p>Sai mais barato do que contratar um por um, e tudo já chega conversando entre si.</p>
  </div>

  <div class="planos">%(planos)s</div>

  <div class="aviso"><b>O site e o Link na Bio entram sem valor de entrada.</b> Contratados separados, custariam R$ 1.297 só para começar. Em qualquer plano, isso não se paga.</div>

  <div class="rodape"><span>SyncTech Automation · Rafael Santos</span><span>(31) 98655-1626</span></div>
</section>

<!-- ═══ 3 · SERVIÇOS, PARTE 1 ═══ -->
<section class="pg">
  <div class="tit">
    <p class="eye">Um por um</p>
    <h2>Prefere contratar só o que precisa?</h2>
    <p>Pode. Cada serviço funciona sozinho, sem plano, e custa o mesmo dentro ou fora de um.</p>
  </div>

  <table>%(mensais1)s</table>

  <div class="rodape"><span>SyncTech Automation · Rafael Santos</span><span>continua na página seguinte</span></div>
</section>

<!-- ═══ 4 · SERVIÇOS, PARTE 2 ═══ -->
<section class="pg">
  <div class="tit">
    <p class="eye">Um por um · continuação</p>
    <h2>O resto do que dá para contratar sozinho</h2>
  </div>

  <table>%(mensais2)s</table>

  <p class="sub2">Pagamento único <span>paga uma vez, é seu, sem mensalidade</span></p>
  <table>%(unicos)s</table>

  <div class="rodape"><span>SyncTech Automation · Rafael Santos</span><span>(31) 98655-1626</span></div>
</section>

<!-- ═══ 5 · COMO FUNCIONA ═══ -->
<section class="pg">
  <div class="tit">
    <p class="eye">Como funciona</p>
    <h2>Do primeiro contato ao ar, em 7 dias</h2>
  </div>

  <div class="passos">%(passos)s</div>
  <div class="cond">%(condicoes)s</div>

  <div class="cta">
    <h3>Vamos ver o que faz sentido pro seu negócio</h3>
    <p>Me chame e me conte o que você faz. Eu digo o que dá para automatizar hoje, o que não dá, e quanto fica.</p>
    <div class="zap">(31) 98655-1626</div>
    <p class="q">Diagnóstico gratuito, sem compromisso · wa.me/%(wpp)s</p>
  </div>

  <div class="rodape"><span>SyncTech Automation · Mariana/MG</span><span>Outubro de 2026</span></div>
</section>

</body></html>"""


def montar():
    resumo = ''.join(
        '<div><p class="n">%s</p><p class="v">%s</p><p class="k">por mês%s</p></div>'
        % (esc(n), brl(m), ', preço final' if i == 0 else '')
        for i, (n, m, a, d, dest, it) in enumerate(PLANOS))

    return HTML % {
        'fontes': FONTES,
        'wpp': WPP,
        'resumo': resumo,
        'planos': ''.join(card_plano(*p) for p in PLANOS),
        'mensais1': ''.join(linha_servico(n, p, f, o) for n, p, f, o in MENSAIS[:8]),
        'mensais2': ''.join(linha_servico(n, p, f, o) for n, p, f, o in MENSAIS[8:]),
        'unicos': ''.join(linha_servico(n, p, f, o) for n, p, f, o in UNICOS),
        'passos': ''.join(
            '<div class="passo"><div class="n">%d</div><div><b>%s</b><p>%s</p></div></div>' % (i + 1, esc(t), esc(d))
            for i, (t, d) in enumerate(PASSOS)),
        'condicoes': ''.join('<div><b>%s</b><p>%s</p></div>' % (esc(t), esc(d)) for t, d in CONDICOES),
    }


if __name__ == '__main__':
    html = montar()
    fonte_html = os.path.join(AQUI, 'pdf-fonte.html')
    io.open(fonte_html, 'w', encoding='utf-8', newline='\n').write(html)
    print('HTML montado: %.0f KB' % (len(html.encode('utf-8')) / 1024.0))

    pdf = os.path.join(SAIDA, 'synctech-servicos-e-precos.pdf')
    cmd = [CHROME, '--headless', '--disable-gpu', '--no-sandbox',
           '--run-all-compositor-stages-before-draw', '--virtual-time-budget=10000',
           '--no-pdf-header-footer', '--print-to-pdf=' + pdf, 'file:///' + fonte_html.replace('\\', '/')]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if not os.path.exists(pdf):
        print('FALHOU\n', r.stdout, r.stderr)
        sys.exit(1)
    print('PDF: %s (%.0f KB)' % (pdf, os.path.getsize(pdf) / 1024.0))
