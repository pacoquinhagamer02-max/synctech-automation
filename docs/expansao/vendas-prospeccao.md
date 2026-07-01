# Vendas & Prospecção — SyncTech Automation

> Ferramenta de prospecção automatizada (Apollo) requer autorização sua em Configurações de Conectores — não consigo ativar sozinho. Enquanto isso, aqui está um kit pra prospectar manualmente.

## Perfil de Cliente Ideal (ICP)

| Critério | Perfil-alvo |
|---|---|
| Tipo de negócio | Barbearia, salão de beleza, clínica de estética, consultório (odonto/fisio), petshop com banho e tosa |
| Tamanho | 1-5 profissionais, agenda cheia mas sem sistema — ainda agenda por WhatsApp/caderno |
| Dor principal | Perde cliente por demora em responder WhatsApp, esquece confirmação, não tem como ver histórico de quem já veio |
| Sinal de prontidão | Tem Instagram ativo, responde DM devagar, tem +2 avaliações reclamando de demora/no-show |
| Localização | Comece pela sua cidade — visita presencial fecha mais rápido que outbound frio |

## Onde encontrar prospects (sem ferramenta paga)

1. Google Maps: busca "barbearia [sua cidade]", "salão de beleza [sua cidade]" — filtra por quem tem poucas avaliações recentes ou reclamação de demora
2. Instagram: hashtag da cidade + nicho (`#barbearia[cidade]`) — perfis com Link na bio quebrado ou sem link de agendamento são prontos pra abordar
3. Indicação: primeiro cliente fechado vira porta de entrada pra indicar outros do mesmo bairro/nicho

## Script de abordagem (WhatsApp — primeiro contato)

```
Oi [Nome]! Vi o [Instagram/perfil] da [Nome do negócio] e achei show.

Trabalho automatizando agendamento e atendimento pra negócios locais
(WhatsApp automático, agenda online, lembrete pro cliente não faltar).

Você perde tempo respondendo WhatsApp de agendamento? Posso te mostrar
em 5 min como automatizar isso sem trocar de número nem contratar
mais gente. Topa ver uma demo rapidinha essa semana?
```

**Regra de ouro**: pergunta aberta no final, nunca "posso te enviar mais informações" (isso mata a conversa).

## Tratamento de objeções

| Objeção | Resposta |
|---|---|
| "Já uso WhatsApp normal, funciona" | "Perfeito, é exatamente esse fluxo que eu automatizo — você continua no mesmo número, só que sem precisar responder toda mensagem na mão." |
| "É caro pra mim agora" | "Entendo. O plano Starter é R$197/mês + R$299 de setup — geralmente 1 cliente a mais que você recupera por não perder agendamento já paga o mês." |
| "Não entendo de tecnologia" | "Não precisa — eu configuro tudo pra você, é só me passar os serviços e preços que eu entrego os links prontos." |
| "Vou pensar" | "Fechado. Te mando o link de demo pra você testar sem compromisso — se fizer sentido, me chama." (sempre deixa a demo, nunca só "ok") |

## Demo em 5 minutos (roteiro de call/presencial)

1. Mostra a página de agendamento já configurada com o nome do negócio dele (usa `setup.html` pra gerar na hora)
2. Mostra o dashboard com o Pipeline Kanban — "aqui você vê todo cliente que agendou, sem precisar abrir o WhatsApp"
3. Mostra a Bio page — "isso substitui o link na bio do Instagram"
4. Fecha com: "Faço o setup completo em [prazo]. Você só precisa me passar os serviços, preços e horários."

## Funil de acompanhamento

- Dia 0: primeiro contato (script acima)
- Dia 2: se não respondeu, reforço curto — "Oi [Nome], só passando aqui — ainda faz sentido eu te mostrar a automação essa semana?"
- Dia 7: última tentativa — "Vou deixar aqui o link de demo caso queira ver com calma: [link]. Qualquer coisa é só chamar."
- Depois disso: move pra lista de "reengajar em 30 dias"

## Métricas pra acompanhar (planilha simples)

| Métrica | Meta inicial |
|---|---|
| Contatos feitos por semana | 15-20 |
| Taxa de resposta | ≥30% |
| Demos agendadas | ≥5/semana |
| Taxa de fechamento demo→cliente | Acompanhar — meta realista no início: 1 em cada 4-5 demos |
