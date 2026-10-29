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
| Loja ver onde cada motoboy livre está | A contagem de motoboys perto usa posição **aproximada** (grade de ~1 km, inteiro exigido pelo servidor), sem nome; some ao ficar offline, pausar ou aceitar corrida | `firebase/firestore.rules` (`disponiveis`), `js/nuvem.js` |
| Memória do aparelho lotar | Histórico limitado a 500 chamados, sem apagar corrida em andamento | `js/store.js` |

Testes automáticos: `node --test tests/*.test.mjs` (36 testes, incluindo valor adulterado, lixo no armazenamento e `__proto__`).

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
- Raio de atuação e ondas de despacho são organização, não trava: a posição vem do celular, então o servidor não confere se o motoboy estava no raio ao aceitar. O documento `disponiveis/{uid}` usa o id da conta; uma loja que já trabalhou com o motoboy conseguiria ver a quadra aproximada (~1 km) dele enquanto ele está livre e online.
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

## Mapa ao vivo (16/10/2026, v13)

- **Para onde vai a posição:** o mapa pede blocos de imagem ao `tile.openstreetmap.org` (revela a região do mapa e a origem do site, sem dados pessoais) e pede a rota ao `router.project-osrm.org` (recebe as coordenadas de origem e destino: moto → loja/cliente, ou loja → cliente na oferta). Nenhum nome, telefone ou id vai junto; `credentials: 'omit'` e sem referrer no OSRM.
- **CSP:** liberados só `img-src https://tile.openstreetmap.org` e `connect-src https://router.project-osrm.org`. Saiu o `frame-src` (o iframe do mapa foi trocado pelo mapa próprio).
- **Resposta do OSRM é dado não confiável:** só números finitos e dentro da faixa entram; até 5.000 pontos; timeout de 8 s; falha volta pra estimativa em linha reta.
- **Limite de uso:** o servidor público do OSRM e os blocos do OSM são pra uso leve. Serve pro piloto em Mariana; com volume, trocar por servidor próprio (OSRM em Docker) ou serviço pago (MapTiler, Stadia, Mapbox) — só muda `OSRM` em `js/rota.js` e `TILES` em `js/mapa-vivo.js`, além do CSP.

## Link de rastreio do cliente, cobrança e volta (16/10/2026, v18)

- **`rastreios/{segredo}`**: segredo de 22 caracteres (132 bits) gerado com `crypto.getRandomValues`, só no link mandado ao cliente, depois do `#`. Regra: `get` só pelo segredo exato; `list` e `delete` proibidos. Guarda loja, ponto de entrega, etapa, nome/moto/placa do motoboy e posição da moto — sem nome, telefone nem código do cliente.
- **Quem escreve:** a empresa cria junto com o chamado (no mesmo lote; o servidor confere que o segredo é o mesmo gravado em `restrito/cliente`). O motoboy da corrida atualiza etapa, identificação e posição; a empresa só marca `cancelado`. A etapa gravada precisa ser igual à do chamado (ninguém mostra "entregue" antes da hora). Posição só nas etapas ativas; some ao entregar/cancelar.
- **Cobrança na entrega:** `cobranca` (pago/dinheiro/maquininha) fica no chamado (o motoboy vê antes de aceitar, sem valor); `cobrar` e `troco` ficam em `restrito/cliente` (só empresa e motoboy aceito leem), números de 0 a 5.000.
- **Volta à loja:** `volta` booleano; o servidor recalcula o frete (ida × 1,5 + chuva) e recusa valor diferente.
- **Regras compiladas** com `firebase deploy --only firestore:rules --dry-run` (sem aviso). Ainda **não publicadas**: publicar as regras ANTES do app v18, senão o servidor recusa chamado com cobrança/volta. As regras novas aceitam o app antigo (campos novos são opcionais). Cópia das regras anteriores no scratchpad da sessão de 16/10.
- **Falta testar no servidor de verdade** (não há Java pro simulador do Firebase nesta máquina): 2 contas com `?nuvem&aba`, chamado com dinheiro + volta, aceite, link do cliente abrindo em aba anônima, tentativa de ler/listar sem segredo e de gravar etapa falsa.

## Auditoria 16/10/2026 (v20, local; regras compiladas, ainda não publicadas)

Método da skill security-audit, feito direto (sem subagentes): só conta falha que cruza uma fronteira real, com prova no código.
**Sem injeção de HTML/script:** todo dado de usuário passa por `esc()` (inclusive `confirmar`); links de WhatsApp/telefone/mapas só com dígitos ou `encodeURIComponent`; e o CSP sem `unsafe-inline` bloquearia script mesmo se algo escapasse.

Corrigido nesta versão:
1. **Link do cliente guardava o ponto de entrega para sempre** (LGPD, baixa): ao entregar/cancelar, `lojaGeo` e `destinoGeo` do `rastreios/{segredo}` são apagados; a regra só permite apagar (nunca trocar) e só nessas etapas.
2. **Espelho do GitHub Pages podia ser aberto dentro de outro site** (clique enganado, baixa): o app se recusa a rodar dentro de moldura. No Netlify o `frame-ancestors 'none'` já barrava. (A trava em si não foi exercitada no teste: o CSP do próprio app impede montar a moldura de teste.)
3. **Link de rastreio malformado deixava a página em branco** (falha): agora mostra "Link não encontrado".

Riscos que continuam (decisão de produto/plano, não código):
- **Sem App Check + contas anônimas ilimitadas** (média, disponibilidade): no plano grátis (Spark) alguém pode gastar a cota diária de leituras/gravações com chamados falsos ou leituras em massa e derrubar o app pra todos até o dia virar. Correção: ativar Firebase App Check (reCAPTCHA/Play Integrity) e, depois, login por telefone.
- **Espera paga depende da chegada informada pelo motoboy** (média-baixa, integridade): "cheguei" longe da loja só pede confirmação no app; o servidor não confere distância. A loja vê "Esperando há…", mas não contesta. Correção sugerida: a espera só conta depois que a loja tocar "motoboy chegou" (ou cobrar espera só com chegada pelo GPS + revisão).
- **Plano e taxa escolhidos pela própria loja** (sem perda hoje): `perfis.plano` e `chamados.taxa` vêm do app; favoritos (recurso pago) não são travados no servidor. Sem cobrança automática ainda, não há dinheiro em jogo; antes de cobrar pelo app, mover plano/taxa pra lado do servidor (Cloud Function, plano Blaze).
- **Posição aproximada do motoboy livre é ligável à conta** (baixa, privacidade): `disponiveis/{uid}` usa o uid como id; uma loja que já teve corrida com ele sabe o uid e pode acompanhar a quadra (~1 km) enquanto ele está online e livre. Correção definitiva: contagem agregada por Cloud Function (Blaze).
- **Identidade autodeclarada** (nome da loja e do motoboy) — já listado acima.

## Fase 2 (29/10/2026): várias paradas, foto, turnos, relatório, login por SMS
Regras publicadas e testadas no servidor real com 2 contas. Recusados: pular parada sem código, entregar a corrida inteira direto,
palpite de código de outra parada, foto maior que 350 KB, foto que não é JPEG, foto em parada inexistente, motoboy lendo os códigos,
aceitar turno em nome de outro, aceitar turno mudando o valor, motoboy desmarcando turno, turno de 19 h, fechar turno antes do horário,
loja desmarcando turno aceito sem pagar a 1 hora.
- Código de cada parada em `restrito/codigo.valores`; o palpite grava `codigoParada` e só vale pra parada atual.
- Foto da entrega fica no Firestore (JPEG em base64, < 350 KB), sem Storage pago. Só o motoboy da corrida grava; só ele e a loja leem.
- Itens da lista `restrito/cliente.paradas` não têm tamanho conferido pelo servidor (regras não percorrem listas); só a loja dona e o
  motoboy da corrida leem, e o app escapa tudo (esc + Trusted Types).
- Login por SMS: o reCAPTCHA do Google entra no CSP (script/frame/connect/img só nos caminhos /recaptcha/) e uma política Trusted Types
  "default" aceita apenas as URLs exatas do reCAPTCHA. **Ainda não ativado**: precisa ligar o provedor Telefone no Firebase (exige plano Blaze).

## Auditoria 29/10/2026 (revisor independente + correções, v22)
Corrigido e testado no servidor real: fila de chamados abertos só mostra as últimas 2 h (30 chamados esquecidos travavam a fila);
posição do motoboy gravada no máximo a cada 5 s e só no link do cliente da vez (cota grátis); link do cliente mostra "entregue"
na hora certa; corrida não fica presa depois da coleta (loja cancela pagando o frete inteiro; motoboy desiste após 20 min com R$ 5);
km declarado não pode ser menor que 80% da linha reta até o cliente (recusado no servidor); chamado só nasce junto com código e
dados do cliente; códigos com 4 números conferidos; foto só depois da entrega daquela parada e não pode ser trocada; turno
desmarcado depois de começar paga as horas passadas + 1; loja marca falta do motoboy 20 min após o início; turnos e motoboys
disponíveis vencidos saem das consultas; CSV neutraliza também tab/CR; rastreio.html aceita a política "default".
Riscos que ficam: falta do motoboy no turno é palavra da loja (sem contestação); reCAPTCHA no CSP de todas as telas
(host contornável segundo o CSP Evaluator, mitigado porque todo dado passa por esc); relatório usa os últimos 200 chamados.
