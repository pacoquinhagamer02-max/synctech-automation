# Arquitetura de um sistema de delivery — explicada pelo Marca aí

Documento de estudo. Mostra **como um app de entrega (do porte do iFood) é montado por dentro** e **onde cada peça dessa arquitetura vive no código do Marca aí**.

> **Como este documento foi feito:** a arquitetura abaixo é o padrão público de sistemas de delivery — o que esses apps fazem na tela, o que a imprensa e a documentação técnica descrevem, e os padrões de engenharia conhecidos (máquina de estados, despacho por geolocalização, regras no servidor). **Nada aqui foi descompilado** do iFood ou de qualquer concorrente: o código deles é fechado e protegido. Cada função foi escrita do zero no Marca aí. O documento liga o conceito ao arquivo real.

---

## 1. As 4 camadas de qualquer app de delivery

Todo sistema desse tipo se divide em quatro camadas. A regra de ouro: **o celular nunca decide nada sozinho — quem manda é o servidor.**

```
┌─────────────────────────────────────────────┐
│  1. APRESENTAÇÃO (telas)                      │  ← o que loja/motoboy/cliente veem
├─────────────────────────────────────────────┤
│  2. DOMÍNIO (regras do negócio)               │  ← preço, etapas, quem pode o quê
├─────────────────────────────────────────────┤
│  3. DADOS (onde o estado mora)                │  ← aparelho OU servidor
├─────────────────────────────────────────────┤
│  4. SERVIDOR (a verdade, à prova de fraude)   │  ← confere tudo de novo
└─────────────────────────────────────────────┘
```

No Marca aí cada camada é um conjunto de arquivos:

| Camada | Arquivos do Marca aí |
|---|---|
| Apresentação | `js/app.js`, `js/ui.js`, `js/mapa-vivo.js`, `js/instalar.js`, `rastreio.html` + `js/rastreio.js`, `css/app.css` |
| Domínio | `js/regras.js`, `js/corridas.js`, `js/esquema.js` |
| Dados | `js/store.js`, `js/armazens.js`, `js/nuvem.js` |
| Servidor | `firebase/firestore.rules` |

O segredo do design: **a camada de apresentação só chama a de domínio, e a de domínio só chama a porta de dados.** Trocar o banco (de aparelho pra servidor) não mexe em nenhuma tela. É o que o livro chama de *arquitetura em camadas* / *ports and adapters*.

---

## 2. Camada de domínio — o coração do negócio

É aqui que vivem as **regras puras**: funções que só recebem dados e devolvem dados, sem tocar em tela nem em internet. Por serem puras, dá pra testar sozinhas (são os 49 testes em `tests/`) e **reaproveitar no servidor**.

### 2.1 Preço do frete — `js/regras.js`

```
frete(km, chuva, volta)   →  R$ 8 até 3 km, +R$ 2/km, +R$ 2 chuva, +50% se volta
```

O mesmo cálculo existe em dois lugares que **têm de concordar**: no app (`frete`) e no servidor (`freteCerto` nas regras). Se o celular mandar um preço adulterado, o servidor recusa. Esse é o padrão **"nunca confie no cliente"** — a base de todo sistema que mexe com dinheiro.

### 2.2 Máquina de estados da corrida — `js/regras.js` + `js/corridas.js`

Uma entrega é uma **máquina de estados**: ela só anda numa ordem permitida.

```
aberto → aceito → coleta → coletado → entregue
   └──────────────┴──── cancelado
```

- `podeIr(de, para)` (em `regras.js`) é a tabela de transições permitidas.
- `criarCorridas(...)` (em `corridas.js`) é o **módulo profundo** que concentra todo o ciclo: `chamar`, `aceitar`, `avancar`, `noGps`, `cancelar`, `gorjeta`, `avaliar`. Cada um devolve `{ok}` ou `{ok:false, motivo}`.

Por que isso importa: sem máquina de estados, dois toques rápidos ou dois celulares poderiam "entregar" antes de "coletar". Com ela, qualquer caminho inválido é barrado num lugar só.

### 2.3 Validação de tudo que entra — `js/esquema.js`

`limparChamado`, `limparPerfil`, `limparEstado` pegam qualquer dado (do aparelho, do servidor, de um link) e **devolvem uma versão limpa e tipada**, descartando o que for inválido e **recalculando o valor** (um frete adulterado no armazenamento é ignorado). É a fronteira que impede lixo de entrar no sistema.

---

## 3. Camada de dados — a porta que troca o backend

Aqui mora o truque de arquitetura mais importante do Marca aí.

`corridas.js` não sabe se os dados estão no aparelho ou no servidor. Ele só conhece uma **porta** (interface) chamada "armazém", com 4 métodos: `lista`, `criar`, `aplicar`, `publicarPosicao`.

Existem dois **adaptadores** que encaixam nessa porta (`js/armazens.js` e `js/nuvem.js`):

```
          corridas.js  (não muda nunca)
               │  usa a porta "armazém"
      ┌────────┴────────┐
armazemLocal        armazemNuvem
(aparelho,           (Firebase,
 modo demo)           celulares diferentes)
      └────────┬────────┘
         armazemMisto  ← decide qual usar por chamado
```

É o padrão **Ports & Adapters** (ou "Hexagonal"). O ganho: pra trocar o Firebase por outro servidor um dia, muda **um arquivo** (`nuvem.js`) — nenhuma tela, nenhuma regra.

- `store.js` — único ponto que lê/grava no aparelho (localStorage) e avisa quem escuta.
- `nuvem.js` — fala com o Firebase: login, escuta em tempo real (`onSnapshot`), e traduz o documento do servidor pro formato que as telas já usam (`paraLocal`).

---

## 4. Camada de servidor — a verdade à prova de fraude

`firebase/firestore.rules` é onde o sistema fica honesto. **Cada escrita é conferida de novo**, independentemente do que o app fez. Exemplos reais do Marca aí:

- O frete é recalculado (`freteCerto`) — preço adulterado é recusado.
- O código de entrega de 4 números o motoboy **nunca consegue ler**; ele só grava palpites (máximo 5), e o servidor compara.
- Os dados do cliente (`restrito/cliente`) só a loja e o motoboy aceito leem.
- O link de rastreio (`rastreios/{segredo}`) só abre com o segredo exato; ninguém lista todos.

Esse é o conceito de **trust boundary** (fronteira de confiança): tudo que vem do celular é "não confiável" até o servidor dizer que vale. Foi isso que a auditoria testou com 16 ataques — todos recusados.

---

## 5. O subsistema de geolocalização (o "mapa ao vivo")

É a parte que mais parece mágica e é pura engenharia. Quatro peças:

| Peça | Arquivo | O que faz |
|---|---|---|
| Leitura do GPS | `js/gps.js` | liga o `watchPosition`, descarta leitura ruim (>80 m), soma o km real |
| Filtro de ruído | `js/rota.js` → `criarFiltroGps` | **filtro de Kalman**: parado, a posição para de tremer; andando, acompanha |
| Rota pelas ruas | `js/rota.js` → `buscarRota` (OSRM) | pede a rota de verdade; `projetarNaRota` "gruda" a moto na rua; `deveRecalcular` refaz quando sai do caminho |
| Desenho | `js/mapa-vivo.js` | pinta os blocos do mapa num `<canvas>`, anima a moto liso entre as leituras |

O padrão de despacho (quem recebe o chamado primeiro) está em `regras.js`: **ondas que crescem** (2 → 4 → 8 km) e raio do motoboy. É o mesmo princípio dos apps grandes — tocar primeiro pra quem está mais perto — construído do zero.

---

## 6. O fluxo inteiro, ponta a ponta

```
LOJA                      SERVIDOR                 MOTOBOY                CLIENTE
 │                           │                        │                     │
 ├─ chamar() ───────────────>│ confere frete,         │                     │
 │  (app.js → corridas.js)   │ cria chamado + código  │                     │
 │                           │ + link de rastreio ────┼────────────────────>│ (recebe link
 │                           │                        │                     │  no WhatsApp)
 │                           │<─── aceitar() ─────────┤ (vê valor, R$/hora, │
 │                           │  só se ainda "aberto"  │  tempo, antes de    │
 │                           │                        │  aceitar)           │
 │  rastreio ao vivo <───────┤<─── GPS a cada 5s ─────┤ (gps.js → rota.js)  │──> moto anda
 │  (posições/{uid})         │                        │                     │    no mapa
 │                           │<─── chegada por GPS ───┤ (cerca de 120m)     │
 │                           │<─── código certo ──────┤ (entregue)          │──> "entregue"
```

Cada seta é uma função que você pode abrir e ler. Esse diagrama **é** o Marca aí.

---

## 7. O que o Marca aí tem a mais (e a menos) que os gigantes

**Igual, por bom motivo:** máquina de estados, despacho por raio/ondas, mapa ao vivo com recálculo, código de entrega, link de rastreio, cobrança na entrega.

**Diferente, de propósito:** o Marca aí trabalha **pro motoboy** (100% do frete, sem punição por recusar). O iFood é um marketplace que traz o cliente; o Marca aí é só a camada de entrega. Por isso ele é muito menor — e é essa a vantagem: dá pra entender o sistema inteiro lendo ~3.000 linhas.

**O que falta (as próximas fases):**
1. Várias entregas num chamado só (rota agrupada).
2. Pedido do cardápio → chama o motoboy sozinho.
3. Entregador reservado por turno.

---

## 8. Resumo de uma frase

> Um app de delivery é uma **máquina de estados** protegida por um **servidor que não confia no celular**, com um **subsistema de GPS** por cima — e trocar qualquer camada não quebra as outras, porque elas se falam por **portas**, não por dentro.

Isso é o que você reconstrói quando "pega a arquitetura" — não o código do iFood, mas o **jeito de pensar** que todo sistema desse tipo compartilha. E o Marca aí é a sua versão, inteira e sua.
