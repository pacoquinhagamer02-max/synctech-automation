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

Testes automáticos: `node --test tests/*.test.mjs` (21 testes, incluindo valor adulterado, lixo no armazenamento e `__proto__`).

## Limite importante: hoje não existe servidor

Nesta versão tudo roda no aparelho. Qualquer pessoa com acesso ao próprio navegador consegue mexer nos próprios dados. Isso não afeta outras pessoas, mas significa que **dinheiro de verdade não pode passar por esta versão**.

Antes de lançar com motoboys e empresas reais, o servidor precisa fazer, ele mesmo:

1. **Login de verdade** (motoboy e empresa), com sessão em cookie `httpOnly` + `Secure` + `SameSite`, nunca em `localStorage`.
2. **Calcular preço, espera, compensação e saldo no servidor.** Reaproveitar `js/regras.js`, que já é puro pra isso.
3. **Conferir o código de entrega no servidor.** O app do motoboy nunca recebe o código, só manda o que o cliente falou. Limite de tentativas no servidor.
4. **Autorização por chamado:** só a empresa dona cancela ou dá gorjeta; só o motoboy que aceitou avança as etapas.
5. **Aceite atômico** no banco (transação), pra dois motoboys não pegarem o mesmo chamado.
6. **Limite de requisições** no login e na confirmação de código.
7. **Pix por gateway** (com webhook assinado e conferido), nunca chave ou token no app.
8. **LGPD:** endereço, telefone e localização do cliente apagados depois de X dias; motoboy vê o endereço do cliente só depois de aceitar; posição do motoboy enviada só pra empresa da corrida em andamento e apagada quando a corrida termina.
9. Hospedar em HTTPS (Netlify ou Cloudflare Pages leem o `_headers`; o GitHub Pages não lê, lá vale só o CSP do `<meta>`).
