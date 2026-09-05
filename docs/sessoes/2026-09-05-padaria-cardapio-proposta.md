# Sessão 05/09/2026 — Cardápio Padaria + Proposta SyncTech

## Cardápio-app (Padaria Cantinho do Pão)
- Adicionado suporte PWA: favicon, apple-touch-icon, `manifest.json`
- Sincronizado nos dois repositórios/URLs:
  - https://pacoquinhagamer02-max.github.io/synctech-automation/padaria-cantinho-do-pao/cardapio.html
  - https://pacoquinhagamer02-max.github.io/cantinhodopao/ (domínio limpo, sem "pacoquinhagamer02" — falta só o token do Netlify pra tirar o resto do path)
- Script `padaria-cantinho-do-pao/sync-to-cantinhodopao.sh` criado pra facilitar sync futuro entre os dois (corrige og:url automaticamente)
- Pendente: fotos de 7 itens do cardápio sem imagem ainda (pastel de queijo, pão francês, pão de queijo, pão de forma integral, bolo de fubá, café coado, suco natural) — bloqueado pelo limite diário do gerador de imagem (ElevenLabs Creative)

## Proposta comercial SyncTech pra padaria
Artifact: https://claude.ai/code/artifact/12759e22-f85b-4210-a205-4fba70845b80

- Reformulada pra focar só em Tráfego Pago (dono vai cuidar do Instagram)
- Preços pesquisados no mercado (fontes: WiseData, André Rocha Consultor, FreelaSemCrise, SocialHub, Rei do Delivery) e ajustados:
  - Gestão de Tráfego Pago: **R$500/mês** + R$297 setup (mercado real: R$800–2.500/mês)
  - Novo serviço: **Aplicativo Personalizado** (painel de pedidos/gestão sob medida) — R$697 setup + R$297/mês
  - Plano Pro reformulado: **R$1.000/mês** + R$899 setup, agora inclui tráfego pago gerenciado + aplicativo personalizado
  - Plano Negócio: R$597/mês (+R$599 setup) · Plano Starter: R$247/mês (+R$349 setup)
  - Demais serviços avulsos (WhatsApp Bot, Agendamento, Instagram Automático, CRM, Catálogo, Link na Bio, Chat, Email, Dashboard) reajustados pra cima
- Mensagem central reformulada: não é "ninguém conhece a padaria" — é "todo mundo já conhece e passa na rua, mas não sabe que agora tem entrega"

## Nota de segurança
Pedido de usar o DiCloak (navegador anti-detecção com 24 perfis/contas clonadas de Flow/Veo3) pra gerar as fotos que faltam foi recusado — usar fingerprint falso pra multiplicar contas grátis é evasão de limite de uso contra os termos do Google, mesmo sendo pra um uso de baixo risco como fotos de padaria.
