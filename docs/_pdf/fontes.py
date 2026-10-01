# -*- coding: utf-8 -*-
"""Baixa as fontes e devolve @font-face com os arquivos em base64.

O Chrome headless gerando PDF nao espera a folha do Google Fonts: a
pagina imprime com a fonte de sistema e o PDF sai com cara de documento
do Word. Ja aconteceu neste projeto. Inline resolve de vez.
"""
import base64, io, json, os, re, urllib.request

UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                    '(KHTML, like Gecko) Chrome/120.0 Safari/537.36'}

FAMILIAS = [
    'Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800',
    'Figtree:wght@400;500;600;700',
]

def baixar(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()

def css_inline():
    partes = []
    total = 0
    for fam in FAMILIAS:
        css = baixar('https://fonts.googleapis.com/css2?family=' + fam + '&display=swap').decode('utf-8')
        # so os blocos latin/latin-ext; os outros alfabetos nao sao usados
        blocos = re.findall(r'/\*\s*([a-z-]+)\s*\*/\s*(@font-face\s*\{[^}]+\})', css)
        for faixa, bloco in blocos:
            if faixa not in ('latin', 'latin-ext'):
                continue
            m = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+\.woff2)\)", bloco)
            if not m:
                continue
            dados = baixar(m.group(1))
            total += len(dados)
            b64 = base64.b64encode(dados).decode('ascii')
            bloco = bloco.replace(m.group(1), 'data:font/woff2;base64,' + b64)
            bloco = re.sub(r'\s+', ' ', bloco)
            partes.append(bloco)
    print('  %d blocos, %.0f KB de fonte embutida' % (len(partes), total / 1024.0))
    return '\n'.join(partes)

if __name__ == '__main__':
    destino = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fontes.css')
    io.open(destino, 'w', encoding='utf-8', newline='\n').write(css_inline())
    print('  gravado em', destino)
