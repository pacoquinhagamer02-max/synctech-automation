# QR code de pagamento (Pix) — Cantinho do Pão

O app já sabe gerar um QR code de Pix com o valor do pedido preenchido
sozinho. Falta só uma coisa: a chave Pix real da padaria. Enquanto essa
chave não estiver no código, a seção de pagamento fica escondida e tudo
continua funcionando exatamente como hoje (combinar no WhatsApp).

## O que é isso, em termos simples

É um **"Pix Copia e Cola" com QR**, no mesmo padrão que qualquer banco ou
maquininha usa. Não tem mensalidade, não tem taxa, não precisa contratar
nada — é um formato aberto do Banco Central. O QR é montado inteiramente
no celular de quem está pagando; nenhuma chave, senha ou dado bancário
passa pelo nosso servidor (aliás, não existe servidor nessa parte — é só
HTML/JS rodando no navegador).

**Importante entender o limite:** isso é Pix **estático**. Ele não avisa
a padaria automaticamente quando alguém paga — pra isso seria preciso
contratar uma API de cobrança de algum banco ou fintech (PSP), que é
outro nível de integração, com custo. Com o Pix estático, a padaria
confere o recebimento pelo próprio aplicativo do banco antes de preparar
o pedido — do mesmo jeito que ela já faz hoje com qualquer Pix recebido.

## Passo 1 — Pegar a chave Pix da padaria

Pergunte pra dona da padaria qual chave ela já usa pra receber Pix. Pode
ser qualquer uma dessas:

- CPF ou CNPJ
- E-mail
- Telefone (com DDD e código do país, ex: `+5531999999999`)
- Chave aleatória (um código tipo `123e4567-e89b-12d3-...`)

**Não precisa ser uma chave nova** — é a mesma que ela já usa no dia a
dia. Copie exatamente como está no aplicativo do banco dela.

## Passo 2 — Colar no app

Em `cardapio.html`, procure:

```javascript
const PIX_CHAVE = '';
```

Cole a chave entre as aspas. Por exemplo:

```javascript
const PIX_CHAVE = 'padaria.cantinho@gmail.com';
```

Confira também estas duas linhas logo abaixo — são só o nome e a cidade
que aparecem no QR (não afetam o pagamento, é rótulo de exibição; a
maioria dos bancos mostra pro pagador o nome de verdade do dono da chave,
consultado direto no Banco Central):

```javascript
const PIX_NOME = 'Cantinho do Pao';
const PIX_CIDADE = 'Mariana';
```

Salve, rode o `sync-to-cantinhodopao.sh` e faça o push como sempre.

## Passo 3 — Conferir

1. Abra o app, adicione um item, abra o carrinho.
2. Deve aparecer uma caixa **"Pagar com Pix"** com o QR e o valor certo.
3. Escaneie com o **próprio celular da padaria** (ou peça pra ela testar)
   e confirme que abre o app do banco dela com o valor preenchido — **não
   finalize o pagamento**, só confirme que abriu certo.
4. Teste o botão **"Copiar código Pix"** — cole no Pix Copia e Cola do
   banco pra ver se reconhece.

Se o banco não reconhecer o código, o motivo mais comum é a chave colada
errada (espaço sobrando, chave de outra conta). Confira letra por letra.

## Perguntas que provavelmente vão aparecer

**"O cliente pode pagar errado, um valor diferente do pedido?"**
Não pelo QR — o valor vem preenchido e a maioria dos apps de banco não
deixa editar um QR com valor fixo. Pelo código copia-e-cola também sai
com o valor embutido.

**"Como a padaria sabe que aquele Pix específico é daquele pedido?"**
Pelo valor e horário, batendo com o pedido que chegou no WhatsApp — é
manual, mas é exatamente assim que qualquer estabelecimento pequeno sem
maquininha integrada já confere Pix hoje.

**"Dá pra automatizar essa confirmação no futuro?"**
Dá, mas exige contratar uma cobrança Pix via API de algum banco ou
fintech (PSP) — isso é outro projeto, com outro custo. Se um dia a
padaria quiser isso, me avisa que a gente conversa sobre as opções.
