# Roadmap de Produto — SyncTech Automation

> Baseado na análise competitiva já feita no projeto (commit `67df70a`, vs Trinks/Booksy) + padrões de mercado (GatherUp, ManyChat, Kommo) já referenciados no hub. Não inclui pesquisa web nova — se quiser dados atualizados de concorrentes, posso rodar uma pesquisa dedicada.

## Onde a SyncTech já compete bem

| Área | Status |
|---|---|
| Agendamento online | Paridade com Trinks/Booksy (intake form, waitlist) |
| WhatsApp automatizado | Diferencial — Trinks/Booksy não têm bot nativo |
| CRM + Pipeline | Diferencial — combina agenda + funil de vendas em um só painel |
| Link na bio | Diferencial — substitui Linktree separado |
| Gestão de reputação Google | Diferencial — roteamento inteligente de avaliação (GatherUp pattern) |

## Gaps prováveis (onde SMBs geralmente reclamam de ferramentas parecidas)

1. **Pagamento online integrado** — Trinks/Booksy permitem cobrar sinal/pagamento no ato do agendamento; o hub hoje não tem isso
2. **App mobile / PWA instalável** — dono do negócio provavelmente quer ver o dashboard sem abrir navegador toda vez
3. **Notificação push pro dono** — hoje o fluxo depende de abrir o dashboard; um alerta automático de "novo agendamento" aumentaria a percepção de valor
4. **Multiusuário/permissão** — se o negócio cresce e contrata recepcionista, hoje não há como dar acesso limitado
5. **Relatório automático semanal** — enviar por WhatsApp/e-mail um resumo ("essa semana: 12 agendamentos, R$X faturado, 3 leads não respondidos") sem o dono precisar abrir o dashboard

## Priorização (impacto x esforço)

| Feature | Impacto | Esforço | Prioridade |
|---|---|---|---|
| Relatório semanal automático (Make.com → e-mail/WhatsApp) | Alto (percepção de valor imediata) | Baixo (reusa infra do Make.com já existente) | ✅ Guia pronto — ver [cenario-make-relatorio-semanal.md](cenario-make-relatorio-semanal.md), falta só configurar no Make.com |
| Pagamento online (sinal via Pix) | Alto (reduz no-show, diferencial forte) | Médio | 🟠 Segunda onda |
| PWA instalável do dashboard | Médio | Baixo-médio (já é HTML, falta manifest + service worker) | 🟠 Segunda onda |
| Notificação push | Médio | Médio (depende de PWA) | 🟡 Depois do PWA |
| Multiusuário/permissão | Médio (só importa pra clientes que crescem) | Alto | 🟢 Backlog |

## Quick win recomendado para essa semana

**Relatório semanal automático** — usa a mesma infraestrutura Make.com que já existe (Schedule → Sheets → WhatsApp/Gmail), só precisa de um novo cenário. Reforça a percepção de "automação de verdade" pro cliente sem ele precisar abrir nada, e é uma ótima peça de marketing ("veja seu resumo da semana sem fazer nada").

## Próximo passo sugerido

Quer que eu:
1. Implemente o PWA (manifest.json + service worker) no `dashboard/` agora?
2. Desenhe o cenário Make.com do relatório semanal (passo a passo pronto pra você configurar)?
3. Rode uma pesquisa web atualizada sobre o que Trinks/Booksy/GatherUp lançaram recentemente?
