# Recepcionista por voz (IA atende ligação) — como funciona e como montar

Pesquisado em 09/09/2026. Preços em dólar convertidos na cotação do dia (R$5,09).
Como preço de ferramenta muda com frequência, confirme direto no site antes de fechar
qualquer coisa com um cliente.

## O que é, em termos simples

Hoje toda a automação da SyncTech atende por texto (WhatsApp, Instagram). Isso é uma
categoria separada: um número de telefone que, quando alguém liga, é atendido por uma
IA que fala com a pessoa em tempo real — agenda horário, responde dúvida, transfere
pra você se precisar. Não é gravação nem menu de "aperte 1" — é conversa de verdade,
com voz sintetizada.

Faz sentido pra negócios que ainda recebem ligação de telefone: clínicas, consultórios,
oficinas. Padaria e barbearia recebem pouca ligação hoje (o fluxo já é WhatsApp), então
não é prioridade pras duas clientes atuais — mas é um diferencial real pra prospectar
esse outro perfil de negócio.

## A ferramenta: Retell AI

Pesquisei duas opções. **Dapta** fala espanhol com sotaque latino-americano — não achei
confirmação de que atende bem em português do Brasil. **Retell AI tem uma página
dedicada a português do Brasil**, então é a opção certa pra começar.

Retell não é "um produto pronto que você assina" — é uma plataforma que você monta,
juntando três peças:

1. **Um número de telefone** — via Twilio ou Telnyx (parceiros de telefonia do Retell)
2. **Um modelo de IA (LLM)** — GPT, Claude ou Gemini, você escolhe
3. **Uma voz (TTS)** — ElevenLabs, Cartesia, OpenAI, entre outras

O Retell junta essas três peças e faz a ligação funcionar. Isso significa que o custo
final não é um número fixo — é a soma dessas partes, cobrada por minuto de ligação.

## Quanto custa de verdade

- Preço anunciado: **US$0,07/minuto**
- Preço realista, somando LLM + voz + telefonia: **US$0,13 a US$0,31/minuto** (≈ R$0,66 a
  R$1,58/minuto)
- **20 chamadas simultâneas grátis**; cada uma a mais custa US$8/mês (≈ R$41/mês)
- US$10 de crédito grátis pra testar (≈ R$51)
- Caller ID com nome da empresa aparecendo (opcional): US$200/mês (≈ R$1.018) — não vale
  a pena pro porte de cliente que você atende, ignorar por enquanto

**Isso é a parte importante pra precificar certo**: diferente de Make.com ou Z-API (onde
você paga um valor fixo por mês), aqui o custo varia direto com quanto o telefone da
empresa toca. Um mês parado custa quase nada; um mês de alto volume pode custar bem mais
que um plano fixo aguenta. Cobrar um valor fixo do cliente sem prever isso é risco de
prejuízo seu, não dele.

## Como montar, passo a passo

1. Cadastro grátis em **dashboard.retellai.com** (vem com US$10 de crédito)
2. Escolher o LLM, a voz (TTS) e o provedor de telefonia (Twilio ou Telnyx) — dá pra
   testar combinações diferentes de custo/qualidade antes de decidir com qual ficar
3. Usar um template de agente pronto e configurar o roteiro (o que a IA deve saber
   responder, quando deve transferir pra um humano, etc.) — isso é o trabalho de
   verdade, equivalente a treinar uma atendente nova
4. Testar em simulação antes de conectar o número real do cliente
5. Conectar o número — pode ser um número novo (comprado no Twilio/Telnyx) ou, em
   alguns casos, portar o número que o cliente já usa

## Como precificar pro cliente (proposta)

Dado que o custo varia por minuto, a estrutura mais segura pra você é **setup + mensal
com minutos inclusos + excedente por minuto** — o mesmo formato que operadora de celular
usa, e por um motivo parecido:

- **Setup: R$497** (configurar o agente, testar o roteiro, conectar o número)
- **Mensal: R$397**, incluindo até **300 minutos** de ligação (~R$200-470 de custo real
  nessa faixa, dependendo do LLM/voz escolhidos — ainda sobra margem)
- **Excedente: R$1,80/minuto** além dos 300 — cobre o custo real (R$0,66-1,58) com folga

Isso é uma sugestão de estrutura, não preço fechado — ajuste depois de rodar um teste
real com um cliente e ver o volume de ligação de verdade.

## Antes de vender isso pra alguém

- Rodar um teste real (com o crédito grátis) antes de prometer isso a qualquer cliente
  — nunca vender uma tecnologia que você ainda não testou na prática
- Confirmar que o roteiro de voz em português soa natural o suficiente — sotaque e
  naturalidade em PT-BR variam por combinação de LLM+voz, e isso só se sabe ouvindo
- Definir com clareza o que a IA NÃO deve tentar resolver sozinha (ex: reclamação,
  emergência) — precisa de uma regra clara de "quando transferir pra humano"

## Fontes

- [Portuguese (Brazil) AI Voice Agents — Retell AI](https://www.retellai.com/languages-ai/brazil-portuguese-ai)
- [AI Phone Agent Pricing — Retell AI](https://www.retellai.com/pricing)
- [Retell AI Pricing 2026 — CloudTalk](https://www.cloudtalk.io/retell-ai-pricing/)
- [Dapta AI Receptionist](https://dapta.ai/blog-posts/best-ai-receptionist/)
