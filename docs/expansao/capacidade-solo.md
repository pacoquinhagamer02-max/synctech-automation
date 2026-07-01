## Capacity Plan: SyncTech Automation (operação solo)
**Período:** contínuo | **Equipe:** 1 pessoa (Rafael), dividindo tempo com canal YouTube e Shopee/afiliados

### Tempo por cliente (baseado no `runbook-onboarding-cliente.md`)

| Atividade | Tempo estimado |
|---|---|
| Onboarding (setup.html + planilha + Make.com + entrega) — 1ª vez | ~1h30 (com buffer pra troubleshooting) |
| Manutenção semanal por cliente ativo (monitorar Make.com, responder dúvida) | ~15 min/semana |
| Prospecção (contatos + demos, ver `vendas-prospeccao.md`) | ~4-6h/semana pra manter 15-20 contatos e 5 demos |

### Cenários de capacidade (ajuste conforme suas horas reais disponíveis por semana)

| Horas/semana dedicadas à SyncTech | Prospecção | Onboardings novos possíveis/mês | Clientes ativos sustentáveis (manutenção) |
|---|---|---|---|
| 5h | Reduzida (2-3h) | ~1 por mês | ~8 clientes (15min × 8 = 2h/semana) |
| 10h | Completa (5h) | ~2-3 por mês | ~16 clientes |
| 20h | Completa + folga | ~4-5 por mês | ~30+ clientes (aqui já compensa automatizar mais ou contratar) |

### Gargalo identificado

Com o processo atual, **o limite não é vender — é o tempo de onboarding manual + manutenção**. Cada cliente novo soma ~15 min/semana de manutenção pra sempre (não é um custo só do onboarding). Em algum ponto entre 15-20 clientes ativos, a manutenção semanal sozinha já consome um dia inteiro de trabalho.

### Recomendações

1. **Agora (0-10 clientes)**: manter tudo manual — o runbook já é rápido o suficiente, o gargalo real é conseguir os primeiros clientes.
2. **Quando bater 10-15 clientes ativos**: priorizar automatizar o Passo 5 do onboarding (relatório semanal, ver `cenario-make-relatorio-semanal.md`) como *template* reutilizável — reduz o tempo de manutenção por cliente.
3. **Quando bater ~20 clientes**: considerar contratar alguém pra fazer onboarding seguindo o runbook (o processo já está documentado o suficiente pra delegar) e você foca em vendas/produto.
4. **Sinal de alerta**: se você perceber que está gastando mais tempo respondendo dúvida de cliente existente do que prospectando cliente novo, é hora de revisar o runbook — normalmente indica que algum passo do onboarding não ficou claro o suficiente pro cliente.

### Cenário "fazer nada" (não escalar processo)
Acima de ~15-20 clientes sem automatizar a manutenção, o tempo de suporte compete diretamente com tempo de vendas — o crescimento trava sozinho, não por falta de demanda.
