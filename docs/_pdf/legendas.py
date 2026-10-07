# -*- coding: utf-8 -*-
"""Legendas e folha de contato das 15 artes.

As legendas saem da MESMA lista que gera a arte (artes.ARTES), entao a
manchete da imagem e o texto do post nunca divergem. Trocar um preco no
artes.py muda os dois.
"""
import io, os, re, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from artes import ARTES, FAMILIA, SAIDA, CHROME, L, A   # noqa: E402

WPP = '5531986551626'

# Hashtags por familia. Volume alto demais afoga um perfil pequeno: a
# mistura e 3 locais (onde ele realmente disputa), 4 do nicho e 2 amplas.
TAGS = {
    'atendimento': '#mariana #ouropreto #mariana_mg #automacaodewhatsapp #whatsappbusiness '
                   '#atendimentoautomatico #chatbot #pequenosnegocios #empreendedorismo',
    'presenca':    '#mariana #ouropreto #mariana_mg #sitepararestaurante #linknabio '
                   '#googlemeunegocio #seolocal #negocioslocais #marketingdigital',
    'vendas':      '#mariana #ouropreto #mariana_mg #traficopago #metaads '
                   '#crm #avaliacaogoogle #vendasonline #marketingdigital',
    'gestao':      '#mariana #ouropreto #mariana_mg #gestaodeestoque #notafiscal '
                   '#automacaocomercial #gestaoempresarial #pequenosnegocios #empreendedorismo',
}

CHAMADA = ('\n───\n'
           'Faz esse serviço sentido pro seu negócio? Me chama no WhatsApp '
           '(31) 98655-1626 que eu faço um diagnóstico gratuito — sem compromisso.\n'
           'Atendo Mariana, Ouro Preto e região.\n')


def limpa(t):
    return re.sub(r'<[^>]+>', ' ', t).replace('  ', ' ').strip()


def legenda(i, familia, titulo, manchete, apoio, ganhos, servico, preco, _):
    h = limpa(manchete)
    return (
        '## %02d — %s\n\n'
        '**Arquivo:** `arte-%02d.png`  ·  **Serviço:** %s  ·  **Preço:** %s\n\n'
        '**Legenda:**\n\n'
        '```\n'
        '%s\n\n'
        '%s\n\n'
        '%s\n'
        '%s\n'
        '%s %s\n'
        '```\n'
    ) % (
        i + 1, titulo, i + 1, servico, preco,
        h + '.',
        apoio,
        '\n'.join('✓ ' + g for g in ganhos),
        CHAMADA,
        servico + ' — ' + preco + '.',
        TAGS[familia],
    )


def montar_md():
    partes = [
        '# 15 artes para o feed — SyncTech Automation\n\n',
        'Formato 1080×1350 (4:5), que ocupa mais tela no feed que o quadrado.\n',
        'Uma arte por serviço do hub. A manchete de cada uma é a **dor** ou o **resultado**, ',
        'nunca o nome técnico — "a mensagem das 22h não espera até amanhã" vende, ',
        '"WhatsApp Bot 24/7" é nome de produto. O nome do serviço e o preço ficam no rodapé do cartão.\n\n',
        '## Ordem sugerida de postagem\n\n',
        'Três por semana, cinco semanas. Cada semana fecha uma família, ',
        'então quem entra no perfil vê um assunto por vez em vez de um amontoado:\n\n',
        '| Semana | Artes | Tema |\n|---|---|---|\n',
        '| 1 | 01, 02, 03 | Atendimento — parar de perder quem já te procurou |\n',
        '| 2 | 04, 05, 06 | Presença — existir onde o cliente procura |\n',
        '| 3 | 07, 08, 09 | Ser achado e ter boa reputação |\n',
        '| 4 | 10, 11 | Vendas — não perder orçamento e trazer gente nova |\n',
        '| 5 | 12, 13, 14, 15 | Gestão — estoque, números, relatório e nota fiscal |\n\n',
        '**Melhor horário para negócio local:** 11h–13h e 18h–21h, de terça a sexta.\n\n',
        '**Antes de postar:** confira se o número do WhatsApp na legenda está certo e ',
        'troque a chamada final pelo seu link curto, se tiver um.\n\n---\n\n',
    ]
    for i, d in enumerate(ARTES):
        partes.append(legenda(i, *d))
    return ''.join(partes)


def folha_contato():
    cartoes = ''.join(
        '<figure><img src="arte-%02d.png" alt="Arte %02d"><figcaption>%02d · %s</figcaption></figure>'
        % (i + 1, i + 1, i + 1, d[5]) for i, d in enumerate(ARTES))
    html = """<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0E0720;padding:40px;font-family:system-ui,sans-serif;width:1340px}
h1{color:#fff;font-size:26px;font-weight:800;margin-bottom:6px}
p.s{color:#A392C9;font-size:14px;margin-bottom:26px}
.g{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
figure{margin:0}
img{width:100%;display:block;border-radius:10px}
figcaption{color:#A392C9;font-size:12px;margin-top:7px}
</style></head><body>
<h1>15 artes para o feed — SyncTech Automation</h1>
<p class="s">1080×1350 · uma por serviço do hub · outubro de 2026</p>
<div class="g">""" + cartoes + '</div></body></html>'

    f = os.path.join(SAIDA, '_folha.html')
    io.open(f, 'w', encoding='utf-8', newline='\n').write(html)
    png = os.path.join(SAIDA, '00-folha-de-contato.png')
    subprocess.run([CHROME, '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
                    '--force-device-scale-factor=1', '--run-all-compositor-stages-before-draw',
                    '--virtual-time-budget=15000', '--window-size=1340,3020',
                    '--screenshot=' + png, 'file:///' + f.replace('\\', '/')],
                   capture_output=True, text=True)
    os.remove(f)
    return png


if __name__ == '__main__':
    md = os.path.join(SAIDA, 'LEGENDAS.md')
    io.open(md, 'w', encoding='utf-8', newline='\n').write(montar_md())
    print('legendas: %s (%.0f KB)' % (os.path.basename(md), os.path.getsize(md) / 1024.0))
    p = folha_contato()
    print('folha de contato: %s (%.0f KB)' % (os.path.basename(p), os.path.getsize(p) / 1024.0))
