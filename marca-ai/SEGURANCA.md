# Segurança do Marca aí

Revisão feita em 07/10/2026 com as skills security-audit, security-and-hardening, best-practices (Addy Osmani), accessibility e performance-optimization.

## O que já está protegido nesta versão

| Ameaça | Proteção | Onde |
|---|---|---|
| Código malicioso em nome, endereço ou observação (XSS) | Tudo passa por `esc()` antes de virar HTML; Trusted Types bloqueia qualquer HTML que não venha da função `html()` do app | `js/ui.js` |
| Script de terceiros ou injetado | CSP: só roda script do próprio site, sem inline, sem `eval`; nenhuma dependência externa (fontes hospedadas no app) | `index.html`, `_headers` |
| Dado adulterado no armazenamento ou em outra aba | Todo dado lido é validado: tipos conferidos, textos cortados, números limitados, status só da lista. O valor da corrida é sempre recalculado pela tabela, nunca lido do dado salvo | `js/esquema.js` |
| Pular etapa (ex.: marcar "entregue" sem coletar) | Máquina de estados: toda mudança de status passa por `podeIr()` | `js/regras.js` |
| Dois aceites no mesmo chamado | Toda escrita relê o estado mais novo antes de gravar (`transacao`) | `js/store.js` |
| Adivinhar o código de entrega | Código gerado com `crypto.getRandomValues`; 5 erros travam a confirmação por 2 min | `js/regras.js`, `js/app.js` |
| Motoboy ver o código de uma empresa real | O código só aparece em chamado marcado como teste (`teste: true`) | `js/app.js` |
| Link de telefone/WhatsApp manipulado | Telefone reduzido a dígitos e validado antes de entrar em `tel:` ou `wa.me` | `js/ui.js` |
| Cache envenenado / versão travada | Service worker guarda só respostas boas do próprio site; rede primeiro | `sw.js` |
| Site embutido em outro (clickjacking) | `frame-ancestors 'none'` e `X-Frame-Options: DENY` | `_headers` (Netlify/Cloudflare) |
| Localização do motoboy virar rastreamento | GPS liga só com o motoboy online e desliga ao ficar offline, apagando a última posição. Leituras imprecisas (>80 m) são descartadas. O mapa real (OpenStreetMap) só abre quando o motoboy pede | `js/gps.js`, `js/app.js` |
| Coordenada falsa ou link malicioso no campo de localização | Só números dentro do globo entram (`geo()`); o link nunca é aberto nem vira HTML, só é lido como texto | `js/esquema.js`, `js/regras.js` |
| Mapa embutido abrir brecha | `frame-src` libera só `www.openstreetmap.org`, e o mapa abre em `<iframe sandbox>` sem referrer | `index.html`, `_headers` |
| Memória do aparelho lotar | Histórico limitado a 500 chamados, sem apagar corrida em andamento | `js/store.js` |

Testes automáticos: `node --test tests/*.test.mjs` (29 testes, incluindo valor adulterado, lixo no armazenamento e `__proto__`).

## Servidor (Firebase, projeto marcaai-mariana) — ligado em 08/10/2026

Regras em `firebase/firestore.rules`, aplicadas pelo servidor em toda leitura e escrita. Testado entre duas contas (empresa e motoboy) e com 10 tentativas de fraude, todas recusadas (`permission-denied`):

| Tentativa de fraude | Resultado |
|---|---|
| Motoboy ler nome, telefone e endereço da cliente antes de aceitar | Recusado |
| Motoboy ler o código de entrega | Recusado (o app dele nunca recebe o código) |
| Pular etapas e marcar "entregue" | Recusado |
| Aceitar no nome de outro motoboy | Recusado |
| Aumentar o valor do frete | Recusado |
| Apagar chamado | Recusado (ninguém apaga; só o administrador) |
| Empresa criar chamado com frete abaixo da tabela | Recusado (o servidor recalcula o frete) |
| Mandar posição sem corrida aceita | Recusado |
| Ler a posição de outro motoboy | Recusado |
| Cobrar espera inventada (R$ 20 com 2 min no balcão) | Recusado (espera conferida pelo relógio do servidor) |

Outras proteções do servidor: só um motoboy consegue aceitar cada chamado; horários (aceite, chegada, coleta, entrega) precisam bater com o relógio do servidor (±2 min); posição do motoboy só é lida pela empresa da corrida em andamento e é apagada ao entregar ou ficar offline; código de entrega conferido no servidor.

Biblioteca do Firebase: empacotada no próprio app (`js/vendor/firebase.js`, só as partes usadas, sem login por popup). `npm audit` aponta 4 alertas "high" em `@grpc/grpc-js`, que só é usado no Firebase para servidor Node e **não entra no pacote do navegador** (conferido). A correção sugerida pelo npm (`--force`) faria voltar pro Firebase 9 e não foi aplicada.

A chave de API em `js/config.js` é pública por natureza (identifica o projeto, não dá acesso). Melhoria futura: restringir essa chave aos domínios do app no Google Cloud.

### Auditoria das regras (08/10/2026, skill oficial firebase-security-rules-auditor)

Nota antes: **2 de 5** (controle de entrega furável). Nota depois das correções: **4 de 5**. Corrigido e testado contra o servidor real:

| Achado | Gravidade | Correção |
|---|---|---|
| Código de entrega descobrível na força bruta (tentativas recusadas não ficavam gravadas) | Grave | Cada palpite agora é gravado (`tentativas`, máx. 5) e "entregue" só vale se o último palpite gravado estiver certo. Testado: 6º palpite recusado mesmo com o código certo; motoboy não zera a contagem; a empresa libera novas tentativas pelo app |
| Motoboy lia os dados da cliente para sempre depois da entrega | Moderado (LGPD) | Leitura só com corrida em andamento |
| km do GPS podia ser zerado ou inflado a cada etapa | Menor | km só cresce, em todas as etapas |
| Avaliação aceitava qualquer etiqueta | Menor | Só as 6 etiquetas do app |
| Posição sem limite de coordenadas | Menor | Latitude, longitude e precisão com faixa |
| Regra de perfis usava `request.resource.size()` (não mede bytes) e não tipava campos | Menor | Cada campo com tipo e tamanho |

**Riscos que continuam (dependem de decisão ou de plano pago):**
- **Contas anônimas ilimitadas:** qualquer pessoa pode criar contas e mandar chamados falsos (motoboy se desloca à toa). Correção: login por telefone pra empresa e Firebase App Check.
- **Identidade autodeclarada:** nome, moto e placa do motoboy (e nome da empresa) são digitados pela própria pessoa. Correção: cadastro verificado (documento/placa) gravado só pelo administrador.
- **Taxa do app informada pelo celular da empresa:** sem cobrança real ainda, não dá prejuízo; quando houver cobrança, calcular no servidor.
- **Observação do chamado é pública pros motoboys antes do aceite:** a loja não deve escrever dados da cliente ali.

**Limitações conhecidas do servidor:**
- Login anônimo: se a pessoa limpar os dados do navegador ou trocar de celular, perde a conta e o histórico. Próximo passo: login por telefone (SMS) ou Google.

## O que ainda falta antes de dinheiro de verdade

Chamados, etapas, código, frete e posição já são conferidos pelo servidor. Saldo, saques e extrato do motoboy ainda ficam só no aparelho, então **dinheiro de verdade ainda não pode passar pelo app**. Falta:

1. **Login de verdade** (motoboy e empresa), com sessão em cookie `httpOnly` + `Secure` + `SameSite`, nunca em `localStorage`.
2. **Calcular preço, espera, compensação e saldo no servidor.** Reaproveitar `js/regras.js`, que já é puro pra isso.
3. **Conferir o código de entrega no servidor.** O app do motoboy nunca recebe o código, só manda o que o cliente falou. Limite de tentativas no servidor.
4. **Autorização por chamado:** só a empresa dona cancela ou dá gorjeta; só o motoboy que aceitou avança as etapas.
5. **Aceite atômico** no banco (transação), pra dois motoboys não pegarem o mesmo chamado.
6. **Limite de requisições** no login e na confirmação de código.
7. **Pix por gateway** (com webhook assinado e conferido), nunca chave ou token no app.
8. **LGPD:** endereço, telefone e localização do cliente apagados depois de X dias; motoboy vê o endereço do cliente só depois de aceitar; posição do motoboy enviada só pra empresa da corrida em andamento e apagada quando a corrida termina.
9. Hospedar em HTTPS (Netlify ou Cloudflare Pages leem o `_headers`; o GitHub Pages não lê, lá vale só o CSP do `<meta>`).
