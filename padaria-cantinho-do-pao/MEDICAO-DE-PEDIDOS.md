# Medição de pedidos — Cantinho do Pão

Registra cada pedido feito pelo app numa planilha do Google. É o que transforma
"postamos X vezes" em **"o app gerou 84 pedidos e R$2.520 em vendas este mês"**.

Enquanto a URL não estiver preenchida no app, tudo continua funcionando
normalmente — só não registra nada. Nenhum risco de quebrar o pedido do cliente.

## Passo 1 — Criar a planilha

1. Crie uma planilha nova no Google Sheets. Nome sugerido: `Pedidos — Cantinho do Pão`
2. Copie o **ID da planilha** da barra de endereço. É o trecho entre `/d/` e `/edit`:
   `docs.google.com/spreadsheets/d/`**`1AbC...XyZ`**`/edit`

## Passo 2 — Colar o script

Na planilha: **Extensões → Apps Script**. Apague o que estiver lá e cole isto,
trocando o ID na primeira linha:

```javascript
const SHEET_ID = 'COLE_O_ID_DA_PLANILHA_AQUI';

function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);
    const planilha = SpreadsheetApp.openById(SHEET_ID);
    const aba = planilha.getSheetByName('Pedidos') || planilha.insertSheet('Pedidos');

    if (aba.getLastRow() === 0) {
      aba.appendRow([
        'Data', 'Tipo', 'Nome', 'Retirada/Entrega', 'Itens', 'Total',
        'Endereço', 'Observações', 'Sabor', 'Tamanho', 'Para o dia', 'Escrita no bolo'
      ]);
    }

    aba.appendRow([
      new Date(dados.data),
      dados.tipo || '',
      dados.nome || '',
      dados.modo || '',
      dados.itens || '',
      dados.total || '',
      dados.endereco || '',
      dados.observacoes || '',
      dados.sabor || '',
      dados.tamanho || '',
      dados.para_o_dia || '',
      dados.escrita || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, erro: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Passo 3 — Publicar

1. **Implantar → Nova implantação**
2. Tipo: **App da Web**
3. Executar como: **Eu**
4. Quem pode acessar: **Qualquer pessoa** ← precisa ser isso, senão o app não consegue gravar
5. Copie a **URL do app da Web** que aparece no final

## Passo 4 — Ligar no app

Em `cardapio.html`, procure a linha:

```javascript
const PEDIDOS_LOG_URL = '';
```

Cole a URL entre as aspas, salve, e rode o `sync-to-cantinhodopao.sh` + push
como sempre.

## Passo 5 — Conferir

Faça um pedido de teste pelo app. A linha deve aparecer na planilha em alguns
segundos. Se não aparecer, confira o passo 3 item 4 — é onde quase sempre erra.

## O que cada tipo registra

| Tipo | Preenche |
|---|---|
| `pedido` | Nome, retirada/entrega, itens, total, endereço, observações |
| `encomenda-bolo` | Nome, sabor, tamanho, para o dia, escrita no bolo |

## Detalhe técnico (por que sendBeacon)

O app usa `navigator.sendBeacon` em vez de um `fetch` comum. Motivo: logo depois
de registrar, a página pula pro WhatsApp. Um `fetch` normal pode ser cancelado no
meio dessa troca e o pedido sumiria do relatório. O `sendBeacon` foi feito
exatamente pra isso — o navegador garante o envio mesmo saindo da página. Se o
navegador for antigo e não tiver `sendBeacon`, cai num `fetch` com `keepalive`.

O `Content-Type` é `text/plain` de propósito: evita o preflight de CORS, que o
Apps Script não responde.
