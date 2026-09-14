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

## Checklist pra levar pra ela — ATUALIZADO 11/09/2026

**Itens 1 e 2 abaixo já estão confirmados**, não precisa mais perguntar:

1. ~~Certificado digital A1~~ — **confirmado**: ela já emite nota fiscal
   nas vendas do balcão, então isso existe.
2. ~~Credenciada pra NFC-e na Sefaz-MG~~ — **confirmado visualmente**: no
   SIARE (`Serviços > Credenciamento de Contribuintes > Credenciar Emissor
   em Homologação`), as linhas **NF-e e NFC-e já aparecem "Habilitado"**
   pro CNPJ dela (38.385.182/0001-39).

**O que ainda falta — e agora é bem mais específico** do que "ela tem
certificado?". A pergunta certa mudou: **qual sistema já está cadastrado
ali, e ele é acessível pela internet ou é um equipamento físico preso ao
caixa?** Isso decide se dá pra integrar no que ela já tem ou se precisa
contratar um emissor à parte só pras vendas do site.

### Perguntas pra levar direto pro contador (ele resolve isso rápido)

1. **No SIARE, em "Consulta" (não em "Credenciar"), quem está cadastrado
   hoje nas linhas NF-e e NFC-e?** — pede o nome do aplicativo e o nome
   da software house que aparecem lá. É literalmente a resposta que
   faltava desde o início: qual sistema ela usa pra emitir a nota local.
2. **Esse sistema é em nuvem (acessa pela internet — Focus NFe, eNotas,
   Bling, Tiny, ou nota integrada à própria maquininha) ou é um SAT/
   impressora fiscal física ligada ao computador do caixa?** Se for
   físico, ele **não tem como conversar com o site** — precisaria de um
   segundo emissor só pra vendas online, mesmo ela já tendo tudo credenciado
   pro balcão.
3. **Se for em nuvem: existe uma chave de API / token de acesso** já
   liberado, ou precisaria pedir um novo pro provedor pra usar no app?
4. **Regime tributário** (MEI, Simples Nacional, Lucro Presumido) — muda
   o cálculo do imposto que entra em cada nota.
5. **Numeração/série de NFC-e em uso hoje** — pra não gerar conflito se
   for preciso abrir um segundo canal de emissão (numeração duplicada
   invalida nota).

### Separado disso — pergunta pra ela, não pro contador
**Qual a marca da maquininha de cartão** (Mercado Pago, PagBank, Stone,
Cielo, GetNet)? O contador não necessariamente sabe isso, mas muda o
caminho técnico: Mercado Pago Point tem nota fiscal integrada de verdade;
PagBank tem nota separada que **não** conversa com venda feita por
API/site; Stone/Cielo/GetNet não têm nota embutida nenhuma.

Assim que tiver essas respostas, é só voltar aqui que eu sigo.

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
