## Runbook: Cenário Make.com — Relatório Semanal Automático
**Owner:** Rafael | **Frequência:** Configurar 1x por cliente, roda toda semana sozinho
**Última atualização:** 01/07/2026

### Propósito
Enviar automaticamente, toda segunda-feira de manhã, um resumo da semana anterior (agendamentos, faturamento, leads não respondidos) pro dono do negócio — sem ele precisar abrir o dashboard. É o quick win identificado em [roadmap-produto.md](roadmap-produto.md): reforça a percepção de automação de verdade e reusa a infra que você já tem no Make.com.

### Pré-requisitos
- [ ] Conta Make.com logada (mesma do cenário "SyncTech — Agendamentos", ID 6260185)
- [ ] ID da planilha Google Sheets do cliente (mesma usada no dashboard)
- [ ] E-mail do dono do negócio (ou número WhatsApp, se já tiver Z-API configurado)
- [ ] Colunas da planilha confirmadas: `Timestamp|Nome|Telefone|Email|Serviço|Preço|Duração|Profissional|Data|Hora|Negócio|Observação`

### Procedimento

#### Passo 1: Criar o cenário
```
Make.com → Create a new scenario → nomear:
"SyncTech — Relatório Semanal — [Nome do Cliente]"
```
**Resultado esperado:** cenário vazio criado, pronto pra adicionar módulos.

#### Passo 2: Módulo trigger — Schedule
```
Adicionar módulo "Schedule" (relógio)
→ Frequência: Weekly
→ Dia: Segunda-feira
→ Horário: 08:00 (America/Sao_Paulo)
```
**Resultado esperado:** o cenário roda automaticamente toda segunda de manhã.
**Se falhar:** confirmar timezone do cenário nas configurações gerais (canto inferior), não só no módulo.

#### Passo 3: Módulo Google Sheets — buscar linhas da semana
```
Adicionar módulo "Google Sheets → Search Rows"
→ Planilha: mesmo ID usado no dashboard do cliente
→ Filtro: coluna "Data" >= (hoje - 7 dias) E <= hoje
```
**Resultado esperado:** retorna só os agendamentos da última semana.
**Se falhar:** se o filtro de data não funcionar direto no módulo, usar "Get Range Values" e filtrar depois com um módulo "Array Aggregator" + "Filter".

#### Passo 4: Módulo Aggregator — calcular totais
```
Adicionar "Array Aggregator" ligado à saída do Passo 3
→ Calcular: total de linhas (nº de agendamentos)
→ Somar coluna "Preço" (faturamento da semana)
→ Contar linhas onde "Observação" contém "não respondido" ou similar
```
**Resultado esperado:** 3 números prontos — total de agendamentos, faturamento, leads pendentes.

#### Passo 5: Módulo de envio (Gmail — recomendado, gratuito)
```
Adicionar "Gmail → Send an Email"
→ Para: e-mail do dono do negócio
→ Assunto: "📊 Resumo da semana — [Nome do Negócio]"
→ Corpo (usar o template abaixo)
```
**Template de mensagem (hook → dados → CTA, direto ao ponto):**
```
Oi [Nome]! Aqui vai o resumo da sua semana:

📅 {{total_agendamentos}} agendamentos confirmados
💰 R$ {{faturamento_semana}} em serviços agendados
⚠️ {{leads_pendentes}} contatos ainda sem resposta

Dá uma olhada nos pendentes aqui: [link do dashboard]

— SyncTech Automation
```
**Resultado esperado:** e-mail chega toda segunda de manhã com números reais da semana.

#### Passo 5b (alternativa — WhatsApp via Z-API)
```
Só configurar se o cliente já tem conta Z-API paga:
Substituir o módulo Gmail por "HTTP → Make a request"
→ POST para o endpoint da Z-API do cliente
→ Corpo: mesmo template acima, formato texto
```
**Nota:** WhatsApp automático depende de conta Z-API paga externa (ainda não configurada — ver pendências do projeto). Comece pelo Gmail, que é grátis e já resolve o objetivo.

### Verificação
- [ ] Rodar o cenário manualmente uma vez ("Run once" no Make.com) e conferir se o e-mail chega com números corretos
- [ ] Comparar os números do e-mail com o que aparece no dashboard do cliente pra mesma semana
- [ ] Confirmar que o cenário está "ON" (não só salvo — precisa ativar o toggle)

### Troubleshooting
| Sintoma | Causa provável | Fix |
|---|---|---|
| E-mail não chega | Cenário está OFF ou módulo Gmail sem permissão | Ativar toggle do cenário; reautorizar conexão Gmail no Make.com |
| Números zerados | Filtro de data do Passo 3 errado (fuso horário) | Conferir se "Data" na planilha está no mesmo formato usado no filtro |
| Faturamento errado | Coluna "Preço" com texto em vez de número (ex: "R$ 50") | Padronizar a planilha pra guardar só o número, sem "R$" |

### Rollback
Desativar o toggle do cenário no Make.com — não afeta o cenário de agendamentos, são independentes.

### Escalação
| Situação | Contato | Método |
|---|---|---|
| Make.com fora do ar | Status Make.com | status.make.com |
| Cliente reclama que não recebeu | Você mesmo | Rodar "Run once" manual e conferir histórico de execuções no Make.com |

### Histórico
| Data | Feito por | Observações |
|---|---|---|
| 01/07/2026 | Rafael (via Claude) | Guia criado — pendente de configuração real no Make.com (requer login manual) |

---

### Próximo passo
Isso precisa ser configurado direto na interface do Make.com (login manual seu) — eu não tenho acesso à sua conta. Depois de criar o primeiro cenário seguindo esse guia, ele vira **template**: pra cada cliente novo, é só duplicar e trocar o ID da planilha + e-mail (mesmo padrão já usado no `runbook-onboarding-cliente.md`).
