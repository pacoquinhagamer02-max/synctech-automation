# Estrutura copiada dos apps que já funcionam

Levantamento de 13/10/2026 para o GPS e o raio de atuação do Marca aí. Foi feito com o método da skill `clone-website`: primeiro a especificação, depois a construção.

Copiamos a **estrutura de funcionamento** (fluxos e regras de despacho). Não copiamos visual nem marca: as cores, os nomes e as telas desses apps são deles, e o Marca aí mantém a identidade própria (asfalto + amarelo de placa).

## O que cada app faz com GPS e raio

| Estrutura | Quem usa | Como funciona lá | Como fica no Marca aí |
|---|---|---|---|
| Despacho em ondas (raio que cresce) | Uber Flash, 99Entrega, iFood (rotas), Machine/Gaudium | O pedido toca primeiro para quem está mais perto. Se ninguém aceita, o raio aumenta | Ondas de 2, 4, 8 km e depois 15 km, a cada 30 s, até o raio máximo que a loja escolheu. Começa depois da janela dos favoritos |
| Raio de atuação do entregador | Machine/Gaudium (área do motorista), Lalamove (distância até a coleta) | O entregador vê só pedidos perto dele e a distância até a retirada antes de aceitar | O motoboy escolhe 2, 5, 10 ou 20 km no Perfil e na tela de corridas. As ofertas vêm ordenadas da loja mais perto para a mais longe |
| Distância e tempo até a coleta na oferta | Uber, 99, Lalamove | "A X km, Y min" no cartão da oferta | Já existia; agora também ordena a lista e aparece em "Outros chamados" |
| Entregadores disponíveis perto da loja | Lalamove, Uber (carrinhos no mapa) | A loja vê quantos estão perto antes de pedir | A empresa vê "N motoboys online a até X km". A posição é **aproximada (~1 km)** e sem nome, para proteger o motoboy |
| Raio de busca da loja | iFood (área de entrega da loja), Machine | A loja define até onde aceita buscar entregador | A empresa escolhe o raio de busca no chamado: 3, 5, 8 ou 15 km |
| Cerca na coleta (chegada automática) | iFood, Uber Flash | O GPS marca a chegada na loja | Já existia (120 m) |
| Conferência de "cheguei" longe da loja | Uber, 99 | O app avisa quando o entregador marca chegada longe do ponto | Confirmação quando o GPS mostra o motoboy a mais de 400 m da loja |
| Cerca no cliente ("chegando") | iFood, Rappi | O cliente e a loja recebem o aviso de "entregador chegando" | Abaixo de 300 m do cliente, o motoboy recebe o aviso para já pedir o código, e a loja vê "chegando no cliente" |

## Regras puras novas (`js/regras.js`, testadas)

- `RAIOS_MOTOBOY = [2, 5, 10, 20]`, `RAIOS_BUSCA = [3, 5, 8, 15]`, `ONDAS_KM = [2, 4, 8, 15]`, `ONDA_MS = 30000`.
- `raioOnda(c, agora)`: raio atual do chamado (ondas a partir do fim da prioridade dos favoritos, nunca acima de `c.raioKm`).
- `alcance(c, pos, raioMotoboy, agora)`: `{ ok, km }`. Sem localização da loja ou sem GPS do motoboy, o chamado aparece (sem filtro possível) e o app avisa.
- `gradeAproximada(ponto)`: posição arredondada a 0,01° (~1 km) para a contagem de disponíveis.
- `perto(a, b, metros)`: cercas de chegada.

## Servidor (`firebase/firestore.rules`)

- `chamados.raioKm` só aceita 3, 5, 8 ou 15.
- Nova coleção `disponiveis/{uid}`: `latC`, `lonC` (inteiros, então a aproximação de ~1 km é garantida pelo servidor) e `em`. Só o próprio motoboy grava e apaga, e qualquer conta logada lê. Ela é apagada quando o motoboy fica offline ou aceita uma corrida.
- Limite conhecido: o servidor não confere se o motoboy estava dentro do raio ao aceitar, porque a posição vem do celular. O filtro de raio é organização do despacho, não trava de segurança.

## Mapa ao vivo e GPS no modelo Uber/iFood (16/10/2026)

Engenharia reversa feita só pelo **comportamento público** dos apps (o que entregador e loja veem na tela) e pelas publicações técnicas do próprio Uber (blog de engenharia: map matching, motor de rotas, ETA). **Nenhum app foi descompilado**: código do Uber/iFood é fechado e protegido; tudo aqui foi escrito do zero.

| O que o Uber/iFood fazem | Como ficou no Marca aí |
|---|---|
| Mapa de verdade na oferta e na corrida | `js/mapa-vivo.js`: blocos do OpenStreetMap num `<canvas>` (sem biblioteca, sem innerHTML; tema escuro por filtro) |
| Rota pelas ruas, não linha reta | `buscarRota` (servidor público do OSRM). Sem internet: linha tracejada e estimativa antiga |
| Ícone anda liso entre as leituras e aponta pra onde vai | Interpolação no tempo entre uma leitura e outra (até 10 s) + seta girando pelo rumo |
| Ícone em cima da rua (map matching) | `projetarNaRota`: a menos de 35 m da rota, a moto "gruda" na rua |
| Trecho já rodado some | A rota é desenhada só do ponto atual pra frente |
| Rota refeita quando sai do caminho | Mais de 60 m fora, 2 leituras seguidas, no máximo a cada 15 s (`deveRecalcular`) |
| Tempo de chegada pela rota | `etaRotaMin`: parte da duração do OSRM que falta. Aparece pro motoboy ("Faltam X km, N min"), pra loja ("chega em N min") e na oferta ("pelas ruas") |
| GPS sem tremida | Filtro de Kalman (`criarFiltroGps`) antes de tudo: parado não "anda"; andando acompanha |

Ficou de fora: grade hexagonal H3 do Uber no despacho (a grade de ~1 km atual resolve em Mariana), navegação por voz (continua no Google Maps/Waze).
