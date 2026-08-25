# Loja Geral & Economia de Gemas

Tom de monetização: **F2P-friendly**. Regra de teste pra qualquer item
novo antes de entrar na loja: *"um jogador que nunca gasta um real
consegue conseguir isso, só mais devagar?"* Se a resposta for não,
não deveria estar na loja assim.

## Moeda premium: Gemas

Universal — usada em qualquer universo/anime, trocada por real.

### Fontes gratuitas de Gema (F2P)

| Fonte | Valor |
|---|---|
| Login diário | **5 Gemas/dia fixas** (disponível pra todos, não é benefício VIP) |
| Conquistas (única vez) | Ver tabela abaixo — front-loaded, maior parte nas primeiras semanas |
| Missões diárias (3-4/dia) | 3-5 Gemas cada |
| Missões semanais (3-4/semana) | 15-25 Gemas cada |

Regra de design das conquistas: **só gema e cosmético, nunca
fragmento/Cristal/moeda local em quantidade relevante** — conquista
não pode virar uma segunda via de grind que compete com o loop
principal.

### Tabela de conquistas (única vez)

| Categoria | Exemplo | Gemas |
|---|---|---|
| Primeiro personagem de cada tier | Desbloquear 1 de cada Tier (×5) | 15 cada |
| Primeiro personagem de cada universo | Desbloquear o 1º de cada anime | 30 cada |
| Nível de conta | 10 / 25 / 50 / 100 | 20 / 40 / 80 / 150 |
| Estrela máxima pela 1ª vez | Evoluir qualquer personagem ao teto | 50 |
| Primeira nota S / SS / SSS | Um atributo de Potencial bate essa nota | 15 / 30 / 60 |
| Kills acumulados | 100 / 1.000 / 10.000 / 100.000 | 10 / 25 / 60 / 120 |
| Coleção por raridade de item | 1 de cada item por raridade (×6) | 20 / 40 / 80 / 150 / 300 / 500 |
| Primeiro refinamento | Usar o 1º Cristal de Refinamento | 20 |

Efeito esperado da curva: jogador engajado nas primeiras 2-3 semanas
acumula ~500-700 Gemas só de conquista — suficiente pra experimentar
um pacote médio sem gastar nada, o que ajuda conversão futura.

## Estrutura da loja

### A. Pacotes de Gemas

Bônus melhor mesmo nos pacotes pequenos, pra não parecer que só vale
gastar muito de uma vez (ajuste do tom F2P-friendly):

| Pacote | Gemas | Bônus |
|---|---|---|
| Pequeno | 60 | — |
| Médio | 330 | +10% |
| Grande | 1.080 | +20% |
| Mega | 2.400 | +33% |
| Baú do Colecionador | 6.500 | +50% |

### B. Loja Semanal Rotativa (geral, separada da Loja de Guild)

| Item | Regra |
|---|---|
| Cristal de Refinamento | 2/semana F2P, +1/semana com assinatura VIP (total 3) — ver `01-qualidade-personagens/potencial-ivs.md` |
| Poção de Aceleração | 2x velocidade de caça por tempo limitado (1h / 24h) |

> Nota: a compra avulsa de **fragmento de personagem** não vive aqui —
> foi movida inteiramente para a Loja de Guild (rotativo diário, 2/dia,
> ver `03-guild/guild-sistema.md`), pra não duplicar o mesmo sistema em
> dois lugares.

### C. Passe Multiverso (temporada, ~30 dias)

Trilha grátis + trilha premium. Recompensas alternam entre os
universos ativos do jogo (evita abandono de algum anime específico).
Trilha grátis precisa ser generosa o bastante pra parecer completa
sozinha — trilha premium é "mais rápido e com cosmético", não "só
assim você consegue".

### D. Ofertas por tempo limitado

- Pacote de Primeira Compra (1x só, preço baixo, valor desproporcional)
- Ofertas de fim de evento — sem timer agressivo (24h é ok; evitar
  janelas de 1h que geram ansiedade desnecessária, fora do tom
  escolhido)

### VIP — Assinatura Mensal

Vendida aqui, mas especificada em detalhe em `02-vip/vip-assinatura.md`
e `02-vip/config-vip.json`. Preço em R$ ainda não definido.

## Guardrails (valem pra loja inteira)

- Nunca vender personagem/fragmento **Lendário ou Mítico** direto —
  só Comum a Épico como conveniência.
- Nenhuma compra garante resultado de sorte (drop, refinamento,
  Potencial) — sempre probabilístico.
- Se for lançar em mercados que regulam loot box (ex.: Bélgica,
  Holanda), pode ser exigência legal informar taxas de drop de
  pacotes com aleatoriedade — validar com jurídico antes do
  lançamento; não é algo definido neste pacote de specs.
