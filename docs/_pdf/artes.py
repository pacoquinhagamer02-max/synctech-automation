# -*- coding: utf-8 -*-
"""15 artes de feed do Instagram, uma por servico do hub.

Estende a linguagem visual do carrossel que o Rafael ja postou (fundo
violeta quase preto, brilho radial no alto, sobrancelha em maiuscula
espacada, numero/manchete gigante, rodape com a marca): o gerador
daquele carrossel se perdeu, so os PNGs ficaram, entao o estilo foi
reconstruido a partir da arte. Fonte Outfit, que e a que mais se
aproxima da original, embutida em base64 — sem isso o Chrome dispara o
screenshot antes de a fonte carregar.

Formato 1080x1350 (4:5), que ocupa mais tela no feed que o quadrado.

A manchete de cada arte e a DOR ou o RESULTADO, nunca o nome tecnico do
servico: "a mensagem das 22h nao espera ate amanha" vende; "WhatsApp Bot
24/7" e nome de produto. O nome do servico fica no rodape do cartao,
junto do preco.
"""
import io, os, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = r'C:\Users\Hashiprod\Desktop\NOVA ERA IA\synctech-automation\docs\artes-instagram'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
FONTE = io.open(os.path.join(AQUI, 'fonte-outfit.css'), encoding='utf-8').read()

L = 1080
A = 1350

# familia, titulo do post (usado nas legendas), manchete, apoio, 3 ganhos,
# nome do servico, preco, posicao do brilho
ARTES = [
 ('atendimento', 'Atendimento que nao dorme',
  'A mensagem das 22h<br><em>não espera até amanhã</em>',
  'Quem decide \u00e0 noite e n\u00e3o recebe resposta, acorda pesquisando o concorrente.',
  ['Responde em segundos, inclusive domingo',
   'Agenda, confirma e remarca sozinho',
   'Chama voc\u00ea s\u00f3 quando o caso \u00e9 complexo'],
  'WhatsApp Bot 24 horas', 'R$ 500/m\u00eas', '18% 8%'),

 ('atendimento', 'Agenda aberta o tempo todo',
  'Sua agenda trabalha<br><em>enquanto você dorme</em>',
  'O cliente escolhe servi\u00e7o, dia e hor\u00e1rio pelo celular, sem precisar falar com ningu\u00e9m.',
  ['Confirma\u00e7\u00e3o na hora e lembrete antes',
   'Lista de espera autom\u00e1tica quando o dia lota',
   'O hor\u00e1rio some da agenda sozinho'],
  'Agendamento Online', 'R$ 297/m\u00eas', '82% 10%'),

 ('atendimento', 'Pedido sem vai-e-volta',
  'O pedido chega pronto,<br><em>com tudo que você precisa</em>',
  'Nada de "quanto \u00e9 o de 500g?" vinte vezes por dia. O cliente monta e manda.',
  ['Foto, pre\u00e7o e quantidade na tela',
   'Itens, total, nome e endere\u00e7o organizados',
   'Sem aplicativo pra baixar e sem taxa por pedido'],
  'Cat\u00e1logo Digital', 'R$ 247/m\u00eas', '20% 85%'),

 ('presenca', 'Aplicativo proprio',
  'Seu negócio na tela<br><em>do celular dele</em>',
  'O cliente instala pelo link e o seu \u00edcone fica junto do WhatsApp e do banco.',
  ['Carrinho, Pix com QR Code e "pedir de novo"',
   'Abre r\u00e1pido mesmo com internet ruim',
   'Sem passar por loja de aplicativo'],
  'Aplicativo Personalizado', 'R$ 1.000/m\u00eas', '85% 15%'),

 ('presenca', 'Site que o Google acha',
  'Quem te procura hoje<br><em>acha o concorrente</em>',
  'Sem site, a busca pelo seu nome entrega quem investiu em estar l\u00e1.',
  ['Servi\u00e7os, pre\u00e7o, endere\u00e7o e hor\u00e1rio',
   'Bot\u00e3o de WhatsApp fixo na tela',
   'Feito pra abrir r\u00e1pido no celular'],
  'Site do neg\u00f3cio', 'R$ 800 \u00fanico', '15% 12%'),

 ('presenca', 'Link na bio que vende',
  'Um link que trabalha,<br><em>no lugar do genérico</em>',
  'A bio do Instagram \u00e9 o lugar mais visitado do seu perfil. E costuma estar vazio.',
  ['Seus servi\u00e7os com pre\u00e7o, um embaixo do outro',
   'Agendar e WhatsApp sempre \u00e0 vista',
   'Link direto pra avaliar no Google'],
  'Link na Bio', 'R$ 497 \u00fanico', '78% 88%'),

 ('presenca', 'Instagram que responde',
  'Comentou no post?<br><em>Já recebeu resposta</em>',
  'Interesse tem prazo de validade curto. Responder uma hora depois \u00e9 quase n\u00e3o responder.',
  ['Comentou, recebe mensagem no direct',
   'Come\u00e7ou a seguir, recebe boas-vindas',
   'D\u00e1 pra agendar pelo pr\u00f3prio direct'],
  'Instagram Autom\u00e1tico', 'R$ 497/m\u00eas', '25% 15%'),

 ('presenca', 'Achado por quem e daqui',
  'Aparecer quando<br><em>a sua cidade procura</em>',
  '"Padaria perto de mim" \u00e9 pesquisa de quem vai comprar hoje, n\u00e3o semana que vem.',
  ['Perfil do Google escrito e revisado',
   '8 publica\u00e7\u00f5es por m\u00eas, prontas',
   'Preparado pra aparecer tamb\u00e9m nas respostas de IA'],
  'SEO Local no Google', 'R$ 697/m\u00eas', '88% 20%'),

 ('vendas', 'Reputacao sob controle',
  'Nota baixa vira conversa,<br><em>não vira estrela</em>',
  'Um cliente insatisfeito que fala com voc\u00ea custa bem menos que um que fala com a internet.',
  ['Nota 4 e 5 vai direto pro Google',
   'Nota 1 a 3 chega como mensagem privada',
   'Perfil revisado e acompanhado todo m\u00eas'],
  'Gest\u00e3o de Reputa\u00e7\u00e3o', 'R$ 650/m\u00eas', '12% 80%'),

 ('vendas', 'Nenhum cliente esquecido',
  'Aquele orçamento<br><em>não some mais</em>',
  'A maior parte das vendas perdidas n\u00e3o foi recusada. Foi esquecida.',
  ['Cada pessoa vira um cart\u00e3o at\u00e9 fechar',
   'Hist\u00f3rico: quantas vezes veio, quanto gastou',
   'Bot\u00e3o que abre a conversa daquela pessoa'],
  'CRM com Pipeline', 'R$ 297/m\u00eas', '80% 85%'),

 ('vendas', 'Cliente novo toda semana',
  'Anúncio com teto<br><em>de custo calculado</em>',
  'Antes de ligar a campanha, a gente calcula quanto um cliente pode custar pro seu ticket e sua margem.',
  ['Campanha montada com p\u00fablico por regi\u00e3o',
   'Produ\u00e7\u00e3o do v\u00eddeo do an\u00fancio inclusa',
   'Ajuste semanal, n\u00e3o \u00e9 "liga e esquece"'],
  'Tr\u00e1fego Pago (Meta Ads)', 'R$ 1.000/m\u00eas', '50% 8%'),

 ('gestao', 'Estoque sem susto',
  'Descobrir que acabou<br><em>antes do cliente</em>',
  'Faltar o produto mais vendido num s\u00e1bado custa o dia inteiro.',
  ['Cada item com a quantidade m\u00ednima que voc\u00ea define',
   'Separa o que acabou, o que t\u00e1 acabando e o que sobra',
   'Lista de compras pronta pro fornecedor'],
  'Controle de Estoque', 'R$ 197/m\u00eas', '22% 22%'),

 ('gestao', 'Seus numeros na palma',
  'Quanto entrou hoje,<br><em>sem abrir planilha</em>',
  'Decis\u00e3o boa precisa de n\u00famero na hora, n\u00e3o no fim do m\u00eas.',
  ['Pedidos e agendamentos do per\u00edodo',
   'Receita e ticket m\u00e9dio',
   'Cliente novo contra cliente que voltou'],
  'Dashboard de M\u00e9tricas', 'R$ 147/m\u00eas', '86% 78%'),

 ('gestao', 'Resultado em numero',
  'O que foi feito<br><em>e o que deu em troca</em>',
  'Todo m\u00eas uma p\u00e1gina com o trabalho e o resultado, comparado com o m\u00eas anterior.',
  ['Indicadores comparados com o m\u00eas passado',
   'Evolu\u00e7\u00e3o de seguidores em gr\u00e1fico',
   'Pr\u00f3ximos passos combinados'],
  'Relat\u00f3rio de Resultados', 'R$ 500/m\u00eas', '14% 50%'),

 ('gestao', 'Nota fiscal no automatico',
  'A nota sai sozinha<br><em>no fim do pedido</em>',
  'Ningu\u00e9m digita nada de novo no caixa, e pedido cancelado nunca vira nota.',
  ['Emitida quando voc\u00ea confirma o pedido',
   'QR Code e link da nota chegam pro cliente',
   'S\u00e9rie separada, sem mexer no balc\u00e3o'],
  'Nota Fiscal (NFC-e)', 'R$ 297/m\u00eas', '70% 25%'),
]

FAMILIA = {
    'atendimento': 'Atendimento',
    'presenca':    'Presen\u00e7a',
    'vendas':      'Vendas',
    'gestao':      'Gest\u00e3o',
}


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def arte(i, familia, titulo, manchete, apoio, ganhos, servico, _preco, brilho):
    """O preco saiu da arte a pedido do Rafael. O campo continua na lista
    porque as legendas saem da mesma fonte e ainda o usam."""
    bolinhas = ''.join(
        '<span class="%s"></span>' % ('on' if k == i else '')
        for k in range(len(ARTES)))
    return u"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
%(fonte)s
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:%(L)dpx;height:%(A)dpx;overflow:hidden}
body{background:#0E0720;color:#F3EDFF;font-family:Outfit,sans-serif;
  -webkit-font-smoothing:antialiased;position:relative}
body::before{content:"";position:absolute;inset:0;
  background:radial-gradient(42%% 36%% at %(brilho)s, rgba(150,88,255,.46), rgba(150,88,255,0) 72%%)}
body::after{content:"";position:absolute;inset:0;
  background:radial-gradient(60%% 40%% at 50%% 118%%, rgba(90,40,180,.30), rgba(90,40,180,0) 70%%)}
.q{position:relative;z-index:1;height:100%%;padding:78px 80px 64px;display:flex;flex-direction:column}

.eyebrow{display:flex;align-items:center;gap:14px;font-size:21px;font-weight:700;
  letter-spacing:.30em;text-transform:uppercase;color:#C5A6FF}
.eyebrow i{width:11px;height:11px;border-radius:50%%;background:#B98BFF;flex:none}

h1{margin-top:auto;font-size:%(tam)dpx;font-weight:800;line-height:1.02;letter-spacing:-.035em;color:#FFFFFF}
h1 em{font-style:normal;color:#B98BFF;display:block}

.apoio{margin-top:34px;font-size:32px;font-weight:400;line-height:1.45;color:#BBA9DF;max-width:21ch}

ul{list-style:none;margin-top:44px;display:flex;flex-direction:column;gap:19px}
li{display:flex;gap:17px;align-items:flex-start;font-size:28px;font-weight:500;line-height:1.3;color:#E6DCFB}
li i{flex:none;width:30px;height:30px;margin-top:3px;border-radius:50%%;
  background:rgba(185,139,255,.17);display:flex;align-items:center;justify-content:center}
li svg{display:block}

.selo{margin-top:auto;padding-top:46px}
.selo span{display:inline-block;border:1px solid rgba(185,139,255,.34);border-radius:999px;
  padding:15px 32px;font-size:27px;font-weight:600;color:#D9C9FF;letter-spacing:.01em}

.rodape{margin-top:40px;padding-top:28px;border-top:1px solid rgba(185,139,255,.20);
  display:flex;align-items:center;justify-content:space-between}
.marca{display:flex;align-items:center;gap:15px}
.marca .mk{width:40px;height:40px;border-radius:11px;background:rgba(185,139,255,.17);
  display:flex;align-items:center;justify-content:center;font-size:23px;font-weight:800;color:#B98BFF}
.marca b{font-size:22px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#C5B4E6}
.dots{display:flex;gap:7px}
.dots span{width:7px;height:7px;border-radius:50%%;background:rgba(185,139,255,.28)}
.dots span.on{width:26px;border-radius:4px;background:#B98BFF}
</style></head><body><div class="q">

<p class="eyebrow"><i></i>%(familia)s \u00b7 SyncTech</p>

<h1>%(manchete)s</h1>
<p class="apoio">%(apoio)s</p>

<ul>%(ganhos)s</ul>

<div class="selo"><span>%(servico)s</span></div>

<div class="rodape">
  <div class="marca"><div class="mk">S</div><b>SyncTech Automation</b></div>
  <div class="dots">%(dots)s</div>
</div>

</div></body></html>""" % {
        'fonte': FONTE, 'L': L, 'A': A, 'brilho': brilho,
        'tam': 86 if len(manchete.replace('<br>', '')) > 46 else 96,
        'familia': FAMILIA[familia].upper(),
        'manchete': manchete,
        'apoio': esc(apoio),
        'ganhos': ''.join(
            '<li><i><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#B98BFF" '
            'stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">'
            '<path d="M2.8 8.4l3.4 3.4L13.2 4.8"/></svg></i><span>%s</span></li>' % esc(g)
            for g in ganhos),
        'servico': esc(servico),
                'dots': bolinhas,
    }


if __name__ == '__main__':
    os.makedirs(SAIDA, exist_ok=True)
    tmp = os.path.join(AQUI, 'arte')
    os.makedirs(tmp, exist_ok=True)

    for i, dados in enumerate(ARTES):
        html = arte(i, *dados)
        f = os.path.join(tmp, 'a%02d.html' % (i + 1))
        io.open(f, 'w', encoding='utf-8', newline='\n').write(html)
        png = os.path.join(SAIDA, 'arte-%02d.png' % (i + 1))
        r = subprocess.run([CHROME, '--headless', '--disable-gpu', '--no-sandbox',
                            '--hide-scrollbars', '--force-device-scale-factor=1',
                            '--run-all-compositor-stages-before-draw',
                            '--virtual-time-budget=8000',
                            '--window-size=%d,%d' % (L, A),
                            '--screenshot=' + png,
                            'file:///' + f.replace('\\', '/')],
                           capture_output=True, text=True)
        ok = os.path.exists(png)
        print('%2d/%d  %-28s %s' % (i + 1, len(ARTES), dados[5][:28],
                                    '%d KB' % (os.path.getsize(png) // 1024) if ok else 'FALHOU'))
        if not ok:
            print(r.stderr[:300]); sys.exit(1)
    print('\n%d artes em %s' % (len(ARTES), SAIDA))
