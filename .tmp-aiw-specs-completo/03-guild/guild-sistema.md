# Guild

Sistema social/cooperativo. Criação é exclusiva de assinante VIP (ver
`02-vip/vip-assinatura.md`); entrar numa guild já existente é livre
pra qualquer jogador, F2P ou não.

## Moeda de Guild

**Selo de Aliança** — moeda própria, separada de Gema e de qualquer
moeda local (Ryo/Zenny/Kan).

Fontes de Selo:
- Doação de moeda local (qualquer membro pode doar)
- Fração automática de cada kill dos membros vira Selo
- Missões de guild (diárias/semanais coletivas)

## Progressão de Guild

| Elemento | Regra |
|---|---|
| EXP de Guild | Soma automática de toda atividade dos membros (kills, missões, doação) |
| Nível de Guild | Sobe com EXP acumulada, sem teto, custo escalando |
| Ponto do líder | +1 ponto por nível de guild, gasto na árvore de passivas |

## Árvore de passivas (distribuída pelo líder)

| Ramo | Efeito por rank | Teto |
|---|---|---|
| Prosperidade | +1% de moeda local pra todos os membros | 5 ranks (+5%) |
| Instinto | +1% de taxa de loot pra todos | 5 ranks (+5%) |
| Disciplina | +1% de EXP pra todos | 5 ranks (+5%) |
| Tesouraria | -X% custo de item na Loja de Guild | 5 ranks |
| Vínculo | +1 slot de membro na guild | 3 ranks |

> **TBD**: se o líder pode resetar/realocar pontos já gastos. Não foi
> confirmado pelo usuário. Sugestão em aberto: permitir reset pagando
> Gemas, pra não travar a guild numa escolha ruim pra sempre, mas sem
> reset gratuito ilimitado (senão a árvore vira ajuste trivial em vez
> de decisão estratégica do líder).

> **Atenção no balanceamento**: os bônus de Instinto/Disciplina da
> guild empilham com os bônus da assinatura VIP individual (+15%
> loot, +20% EXP). Recomenda-se um teto combinado (ex.: nunca passar
> de +40% de EXP ou loot somando VIP + guild) pra evitar que o número
> fique descontrolado em guilds muito avançadas com muitos assinantes.
> Não foi um valor fechado — só recomendação a validar.

## Loja de Guild

Compra com Selo de Aliança.

### Consumíveis

| Item | Efeito |
|---|---|
| Poção de EXP Temporária | Buff de EXP, duração máxima de 2h |
| Poção de Loot Temporária | Buff de taxa de loot, tempo limitado |

### Fragmento de personagem (rotativo diário)

| Regra | Detalhe |
|---|---|
| Rotação | 1 personagem novo por dia, sorteado entre todo o roster |
| Limite de compra | 2 fragmentos por dia, por jogador |
| Preço | Fixo por tier do personagem do dia (ver tabela abaixo) |
| Fonte adicional | Fragmentos do mesmo personagem também dropam (raríssimos) na caça normal |

Preço por tier:

| Tier | Custo por fragmento (Selo) |
|---|---|
| 1 | 30 |
| 2 | 60 |
| 3 | 150 |
| 4 | 400 |
| 5 | 1.000 |

**Por que não precisa de teto adicional**: com 2/dia e rotação diária
entre todo o roster, mesmo no cenário mais otimista (o mesmo
personagem caindo direto na rotação) levaria ~50 dias só de loja de
guild pra fechar os 100 fragmentos necessários. Isso já mantém a loja
de guild como reforço lento, nunca como via rápida de desbloqueio —
não precisa de preço escalonado dentro do dia.

## Fragmento de desbloqueio — regra geral (referência)

100 fragmentos de um personagem = libera ele. Fragmentos vêm de:
caça direta ao personagem (via principal), loja de guild (2/dia,
rotativo), e drop raríssimo aleatório do próprio personagem.
