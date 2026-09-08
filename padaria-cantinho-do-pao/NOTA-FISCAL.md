# Nota fiscal — o que falta de verdade

O app **não emite nota fiscal**, e isso não é uma limitação técnica que dá
pra contornar com código — é porque nota fiscal é documento legal emitido
pela Receita/Sefaz, não algo que se gera sozinho num site. Colocar no app
algo que *parece* nota fiscal sem ser emitido de verdade pelo governo seria
criar um documento fiscal falso, e isso está fora de cogitação.

O que dá pra fazer sem nenhuma dessas exigências é um **comprovante do
pedido** — os itens, quantidade, preço e total, que o cliente já recebe
formatado dentro da própria mensagem de WhatsApp que o app monta. Isso é
recibo informal, não nota fiscal, mas cumpre a função de "sair com o que
comprou e o preço" no dia a dia.

## O que precisa pra ter nota fiscal de verdade (NFC-e)

Delivery de padaria pra consumidor final normalmente usa **NFC-e** (Nota
Fiscal de Consumidor eletrônica), emitida junto à Sefaz do estado — em
Minas Gerais, pela SEF-MG. Pra isso, a padaria precisa ter, nesta ordem:

1. **CNPJ apto a emitir NFC-e.** Isso passa por um credenciamento junto à
   Sefaz-MG — não é automático só por ter CNPJ aberto.
2. **Certificado digital A1** (um arquivo, não um cartão físico) —
   comprado de uma certificadora credenciada (Serasa, Certisign, Soluti,
   entre outras). Tem custo anual; consulte os valores atuais direto com
   uma certificadora, porque isso muda com frequência e não quero te dar
   um número que já esteja desatualizado quando você ler isso.
3. **Um sistema emissor de NFC-e.** É quem efetivamente conversa com a
   Sefaz e gera o cupom fiscal. Opções conhecidas no mercado: **Focus
   NFe**, **eNotas**, **NFE.io**, **Bling**, **Tiny ERP** (os dois
   últimos são ERPs completos, não só emissores). Todos cobram mensalidade
   por volume de notas emitidas — de novo, consulte os planos atuais de
   cada um, os preços mudam.

## O passo que vem antes de tudo isso

**Fale com o contador da padaria antes de contratar qualquer coisa.**
Se ela é MEI, Simples Nacional ou outro regime muda se e como ela é
obrigada a emitir nota por delivery, e isso varia por estado e por
faturamento — é questão tributária de verdade, não uma escolha de
ferramenta, e eu não vou arriscar te dar uma resposta errada sobre
obrigação legal. O contador dela sabe exatamente o enquadramento dela.

## Quando ela tiver isso resolvido

Assim que a padaria tiver CNPJ credenciado, certificado digital e tiver
escolhido um emissor (Focus NFe, eNotas, etc.), me chama com o nome do
emissor escolhido. A partir daí a integração no app é real: ao confirmar
o pedido, o app chama a API do emissor, recebe de volta o link do DANFE
(o QR/comprovante oficial) e manda pro cliente junto com a confirmação
do pedido — no mesmo padrão que já existe hoje pra registrar pedido na
planilha (`PEDIDOS_LOG_URL`, ver `MEDICAO-DE-PEDIDOS.md`) e pro Pix
(`PIX_CHAVE`, ver `PIX-QR-CODE.md`): uma URL/chave que fica vazia até
ela existir, e nada quebra enquanto isso.
