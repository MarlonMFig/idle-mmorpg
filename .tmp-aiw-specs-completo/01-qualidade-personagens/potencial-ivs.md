# Sistema de Potencial (equivalente aos IVs de Pokémon)

Variável de **sorte no momento do desbloqueio**, independente da
Estrela (que é progressão controlada por grind). Dois jogadores com o
mesmo personagem na mesma estrela podem ter exemplares diferentes por
causa do Potencial.

## Atributos (3, não 6 — simplificado pra idle)

| Atributo | O que afeta |
|---|---|
| Poder | Velocidade de caça / dano |
| Sorte | Chance extra de subir um degrau de raridade no drop |
| Fortuna | Bônus de moeda local (Ryo/Zenny/Kan) por kill |

## Rolagem

No momento do desbloqueio, cada atributo recebe um número **oculto**
de 0 a 100. O jogador só vê a nota (letra), nunca o número bruto.

| Nota | Faixa oculta | Bônus | % da população |
|---|---|---|---|
| F | 0–15 | +0% | 16% |
| D | 16–30 | +2% | 15% |
| C | 31–45 | +4% | 15% |
| B | 46–60 | +6% | 15% |
| A | 61–75 | +8% | 15% |
| S | 76–88 | +11% | 13% |
| SS | 89–97 | +15% | 9% |
| SSS | 98–100 | +20% | 3% |

Nota geral exibida na lista/filtro = média das 3 notas (ou a menor —
decidir na implementação qual fica mais claro pro jogador).

## Refinamento (como o jogador melhora o Potencial)

**Cristal de Refinamento**: rerola **um** atributo à escolha do
jogador. Regra fixa: **fica sempre o maior valor entre o antigo e o
novo** — nunca piora o que já existia.

### Fontes de obtenção

| Fonte | Regra |
|---|---|
| Drop em combate | Item raro/épico, cai de qualquer inimigo do tier do personagem, sem limite |
| Loja (premium) | **2 por semana, conta inteira** (não é por personagem), comprado com Gemas |

O cristal comprado na loja segue exatamente a mesma regra de "fica o
maior" — pagar dá a **tentativa**, não o resultado. Isso é o que evita
pay-to-win: quem paga rerola mais vezes, mas ainda depende de sorte.

## Fórmula de poder final

```
Poder final = Base do personagem
            × (1 + bônus de estrela)      // ver qualidade-personagens.md
            × (1 + bônus de Potencial)    // soma ou média dos 3 atributos — definir na implementação
```
