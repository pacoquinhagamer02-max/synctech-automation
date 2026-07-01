## Runbook: Onboarding de Cliente Novo — SyncTech Automation
**Owner:** Rafael | **Frequência:** A cada fechamento de venda
**Última atualização:** 01/07/2026

### Objetivo
Transformar um cliente recém-fechado em um negócio com o hub 100% configurado e funcionando, sem deixar nenhum dos 10 serviços pela metade.

### Pré-requisitos
- [ ] Cliente confirmou o plano (Starter/Negócio/Pro) e pagamento do setup
- [ ] Você tem: nome do negócio, categoria, WhatsApp, Instagram, lista de serviços + preços, horário de funcionamento, nomes dos profissionais
- [ ] Link do Google Meu Negócio do cliente (para avaliação)

### Procedimento

#### Passo 1: Gerar os links do cliente
```
Abrir setup.html → preencher os 4 passos (dados do negócio,
serviços, profissionais, intake questions) → gerar os 2 links
(agendamento + bio)
```
**Resultado esperado:** dois links `#config=...` funcionando, com nome e cores do negócio do cliente.
**Se falhar:** verificar se todos os campos obrigatórios do passo 1 foram preenchidos — o gerador não cria o link com campo vazio.

#### Passo 2: Configurar planilha de dados (Google Sheets)
```
Duplicar a planilha modelo (ID base: 1HDn6wkD0UbMdMhgMkdH5vL4RvVRtgmFSb08wHmritKs)
→ Compartilhar → "Qualquer pessoa com o link pode ver"
→ Trocar o ID da planilha no config do cliente
```
**Resultado esperado:** dashboard do cliente carrega dados reais (`loadSheetsData()` funciona).
**Se falhar:** dashboard aparece vazio — checar se a planilha está pública, não só "compartilhada com pessoas específicas".

#### Passo 3: Configurar webhook no Make.com
```
Duplicar o cenário "SyncTech — Agendamentos" (ID 6260185)
→ Trocar destino (Sheets) pro sheet do cliente novo
→ Copiar a nova URL de webhook
→ Colar no campo webhookUrl do config do cliente
```
**Resultado esperado:** teste de agendamento na página do cliente aparece na planilha em até 1 min.
**Se falhar:** conferir se o cenário está "ON" no Make.com (cenários novos ficam OFF por padrão).

#### Passo 4: Entregar os links pro cliente
```
Enviar via WhatsApp:
1. Link de agendamento → cliente coloca no Instagram/WhatsApp Business
2. Link da bio → cliente coloca no "link na bio" do Instagram
3. Print rápido mostrando onde ver o dashboard
```
**Resultado esperado:** cliente confirma recebimento e consegue abrir os dois links no celular.
**Se falhar:** testar os links você mesmo no celular antes de enviar — problema comum é link quebrado por caractere especial no nome do negócio.

#### Passo 5: Configurar lembrete automático (opcional, se cliente pagou plano Negócio/Pro)
```
Make.com → novo cenário → Schedule (1h) → Google Sheets →
filtrar agendamentos do dia seguinte → Gmail/WhatsApp lembrete
```
**Resultado esperado:** lembrete automático dispara 24h antes de cada agendamento.
**Se falhar:** requer configuração manual no Make.com — reservar 15 min extras nesse passo, não é automático hoje.

### Verificação (checklist final antes de considerar o onboarding concluído)
- [ ] Agendamento de teste aparece na planilha e no dashboard
- [ ] Pipeline Kanban mostra o lead de teste
- [ ] Bio page abre corretamente no celular do cliente
- [ ] Cliente sabe onde ver o dashboard e como reagir a um lead novo (botão WA)
- [ ] Link de avaliação Google configurado no smart review

### Troubleshooting
| Sintoma | Causa provável | Correção |
|---|---|---|
| Dashboard vazio | Planilha não está pública | Refazer compartilhamento como "qualquer pessoa com o link" |
| Agendamento não chega na planilha | Cenário Make.com desligado ou webhook errado | Conferir status do cenário e URL colada no config |
| Link do config não abre | Caractere especial no nome do negócio quebrou o encode | Remover acentos/emoji do nome antes de gerar o link, testar de novo |
| Cliente não recebe lembrete | Cenário de lembrete (Passo 5) não configurado | Confirmar se o plano do cliente inclui esse serviço |

### Rollback
Se algo quebrar em produção para o cliente: reverter para o link anterior salvo (guardar sempre o link gerado antes de qualquer alteração no config) e avisar o cliente que o ajuste está sendo feito.

### Escalação
| Situação | Contato | Método |
|---|---|---|
| Make.com fora do ar | Status Make.com | status.make.com |
| Cliente com problema urgente (agenda não funciona no dia) | Você mesmo | Resposta em até 1h no WhatsApp |

### Histórico
| Data | Feito por | Observações |
|---|---|---|
| 01/07/2026 | Rafael (via Claude) | Runbook criado — ainda sem execução real registrada |
