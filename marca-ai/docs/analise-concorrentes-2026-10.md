# Análise dos concorrentes do Marca aí (16/10/2026)

Engenharia reversa feita pelo **comportamento público** dos apps (o que loja, motoboy e cliente veem), por matérias do setor e pela documentação de sistemas que se integram a eles. Nenhum app foi descompilado: código do iFood, Lalamove, Borzo e Uber é fechado e protegido; copiá-lo viola termos de uso e direito autoral. Tudo o que entrou no Marca aí foi escrito do zero.

## Quem faz o mesmo que o Marca aí

| App | O que oferece pra loja que chama entregador | Destaques que importam pro Marca aí |
|---|---|---|
| **iFood Sob Demanda / Envios iFood** | Entregador do iFood pra pedidos de WhatsApp, telefone e site, sem mensalidade. Preço pela distância. Em **14/10/2026 o iFood ampliou** isso pra pedidos de outros canais. | **Concorrente direto agora.** Cliente recebe **link de rastreio + código de entrega**. Loja preenche endereço à mão e vê o valor antes de confirmar. Também tem "Entrega Dedicada" (entregador por turno). |
| **Lalamove** | Moto, carro e utilitário; app e web; até 19–20 paradas por pedido; API pra e-commerce. | Rastreio em tempo real pro cliente; **múltiplas paradas**; em fev/2026 baixou a comissão do motoboy em corridas até 10 km de 15,99% pra 5,99% (sinal de briga pelo entregador). Atua em ~19 capitais/grandes cidades, não em Mariana. |
| **Borzo (ex-Click Entregas)** | Foco B2B/e-commerce; app e web; preço por distância e peso. | Pedido com **vários pontos de entrega**; reserva de moto ou carro pela web; chat de suporte. Grandes cidades. |
| **Uber Flash / Moto, 99Entrega** | Entrega por app de corrida. | Mapa ao vivo, recálculo de rota, tempo e valor antes de aceitar (já copiados na v13–v17). |
| **Grupo de motoboys no WhatsApp** | Grátis. | O concorrente real em Mariana: o Marca aí precisa ser mais fácil e mais seguro que ele. |

## O que foi copiado e aplicado (v18)

| Melhoria | De onde veio | Por que vale pro Marca aí | Onde está |
|---|---|---|---|
| **Link de rastreio pro cliente** (mapa ao vivo, etapa, nome/moto/placa do motoboy, "chega em N min") | iFood Sob Demanda, Lalamove | Principal argumento contra o grupo do WhatsApp e contra o iFood: o cliente para de ligar pra loja perguntando "cadê?". Vai junto na mensagem do WhatsApp com o código. | `rastreio.html`, `js/rastreio.js`, coleção `rastreios/{segredo}` |
| **Cobrança na entrega** (já pago, dinheiro com troco, maquininha) | Sob Demanda (pedidos de WhatsApp/telefone), cobrança na entrega dos apps de frete | Em cidade pequena muito pedido é pago na porta. O motoboy sabe **antes de aceitar** se precisa levar maquininha ou troco, e depois vê o valor e o troco calculado. | Formulário "Chamar", oferta, corrida, `trocoLevar`/`avisoCobranca` |
| **Volta à loja** (+50% do frete) | "Retorno" dos apps de frete | Maquininha e dinheiro precisam voltar pra loja; hoje isso é combinado no grito e o motoboy não recebe. Marcado sozinho quando a cobrança é na porta. | `frete(km, chuva, volta)` no app e nas regras do servidor |
| **Tempo total e R$/hora na oferta** | Uber, 99 | Motoboy decide pelo quanto a corrida rende por hora, não só pelo valor. | `estimativaCorrida` |
| **Simulador de preço na tela inicial** | Lalamove, Borzo (preço antes do cadastro) | A loja vê quanto custa antes de se cadastrar: tira a dúvida que trava a venda. | Tela de boas-vindas |

## O que ficou de fora (e por quê)

| Ideia | Quem tem | Decisão |
|---|---|---|
| Várias entregas no mesmo chamado | Lalamove (19–20 paradas), Borzo, iFood (rotas agrupadas) | **Próxima fase.** Mexe na máquina de estados, no frete, nas regras do servidor e no código de entrega (um por parada). Vale quando houver loja com 2+ entregas juntas no horário de pico. |
| Motoboy reservado por turno | iFood Entrega Dedicada | **Próxima fase.** Bom produto pra padaria/pizzaria no pico; pede agenda e pagamento por hora. |
| Foto como prova de entrega | Apps de frete | **Depois.** Precisa de armazenamento de arquivos (Firebase Storage exige o plano pago Blaze). O código de 4 números já cumpre o papel. |
| Preço por peso/volume | Borzo | Não se aplica: Marca aí é moto + bag. |
| Taxa de aceitação, punição por recusar | Vários | **Rejeitado:** contraria a proposta "recusar não te prejudica". |
| Comissão sobre o pedido | iFood (até 27%) | **Rejeitado:** ver análise de preço; cobrar 15% do frete, da loja. |

## Segurança do link de rastreio

- O endereço do link leva um segredo de 22 caracteres (132 bits) **depois do #**: não aparece em log de servidor nem é repassado a outro site.
- A página mostra loja, etapa, nome/moto/placa do motoboy e a posição da moto. **Não mostra** nome, telefone nem código do cliente.
- O servidor só deixa ler pelo segredo exato (ninguém lista), só o motoboy da corrida atualiza posição e etapa, e a etapa gravada tem que ser igual à do chamado.
- Depois da entrega ou do cancelamento a posição da moto é apagada do link.

## Fontes

- iFood: [Envios iFood (Mundo Logística)](https://mundologistica.com.br/noticias/envios-ifood-entregas-pedidos-fora-plataforma), [iFood amplia entregas pra outros canais, 14/10/2026 (Mercado & Consumo)](https://mercadoeconsumo.com.br/14/10/2026/foodservice/ifood-amplia-entregas-para-pedidos-recebidos-pelos-restaurantes-em-outros-canais/), [Sob Demanda (Saipos)](https://saipos.com/integracoes/ifood/sob-demanda-ifood), [Entrega Dedicada](https://mundologistica.com.br/noticias/ifood-modalidade-entregadores-dedicados-restaurantes)
- Lalamove: [como funciona (Nuvemshop)](https://www.nuvemshop.com.br/blog/lalamove/), [comissão de moto 5,99% (Mercado & Consumo)](https://mercadoeconsumo.com.br/10/02/2026/logistica/lalamove-reduz-comissao-para-corridas-de-moto-de-ate-10-km/), [como funciona (JivoChat)](https://www.jivochat.com.br/blog/ecommerce/como-funciona-a-lalamove.html)
- Borzo: [chegada ao Brasil (Movimento Econômico)](https://movimentoeconomico.com.br/economia/negocios/2022/03/02/invasao-russa-no-mercado-de-entregas-expressas-do-brasil/), [Borzo BR (PickYourApp)](https://pickyourapp.com/products/borzo-br)
