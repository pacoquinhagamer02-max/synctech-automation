# -*- coding: utf-8 -*-
"""Le os servicos direto de docs/tabela-precos-2026.html.

Ate agora o gerador do PDF tinha a sua propria copia das descricoes, com
uma frase por servico. Duas copias da mesma informacao divergem na
primeira mudanca de preco — ja aconteceu tres vezes nesta sessao. Agora
o PDF le da tabela, que e a fonte, e passa a trazer os itens detalhados
que ela ja tem.
"""
import io, re, json, os

FONTE = r'C:\Users\Hashiprod\Desktop\NOVA ERA IA\synctech-automation\docs\tabela-precos-2026.html'

def limpa(t):
    t = re.sub(r'<[^>]+>', '', t)
    t = (t.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
          .replace('&nbsp;', ' ').replace('&ccedil;', 'c').replace('&atilde;', 'a'))
    return re.sub(r'\s+', ' ', t).strip()

s = io.open(FONTE, encoding='utf-8').read()

servicos = []
for art in re.findall(r'<article class="svc">(.*?)</article>', s, re.S):
    nome = limpa(re.search(r'<h3>(.*?)</h3>', art, re.S).group(1))
    nome = re.sub(r'\s*(no ar|em implanta\u00e7\u00e3o)\s*$', '', nome).strip()
    emImplantacao = 'em implanta' in art

    what = re.search(r'<p class="what">(.*?)</p>', art, re.S)
    what = limpa(what.group(1)) if what else ''

    itens = [limpa(li) for li in re.findall(r'<li>(.*?)</li>', art, re.S)]

    need = re.search(r'<div class="need">(.*?)</div>', art, re.S)
    need = limpa(need.group(1)) if need else ''

    lbl = limpa(re.search(r'<p class="lbl">(.*?)</p>', art, re.S).group(1))
    big = re.search(r'<p class="big">(.*?)</p>', art, re.S).group(1)
    valor = limpa(big)                      # ex.: "R$ 1.000/mes"
    unico = 'nico' in lbl                   # "Valor unico"

    sub = re.search(r'<p class="sub">(.*?)</p>', art, re.S)
    sub = limpa(sub.group(1)) if sub else ''

    servicos.append({
        'nome': nome, 'valor': valor, 'unico': unico, 'obs': sub,
        'what': what, 'itens': itens, 'need': need, 'soon': emImplantacao,
    })

destino = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'servicos.json')
io.open(destino, 'w', encoding='utf-8', newline='\n').write(
    json.dumps(servicos, ensure_ascii=False, indent=1))

print('%d servicos extraidos (%d mensais, %d unicos)'
      % (len(servicos), sum(1 for x in servicos if not x['unico']),
         sum(1 for x in servicos if x['unico'])))
for x in servicos:
    print('  %-32s %-16s %d itens%s' % (x['nome'], x['valor'], len(x['itens']),
                                        '  [need]' if x['need'] else ''))
