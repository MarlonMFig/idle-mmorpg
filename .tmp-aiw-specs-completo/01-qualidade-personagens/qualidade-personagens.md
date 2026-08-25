# Sistema de Qualidade do Personagem

Eixo separado do **Tier** (papel narrativo / força de desbloqueio).
Tier decide em que faixa de dificuldade e recompensa o personagem entra;
Qualidade decide o selo visual, as estrelas e o teto de evolução dele.
Os dois normalmente correlacionam (Tier 5 tende a ser Lendário/Mítico),
mas não são a mesma variável — dá pra ter um Tier 2 com Qualidade Raro
por ser fã-favorito, por exemplo, sem mexer na força dele.

## Tier (referência — já decidido antes deste pacote)

Critério: papel narrativo dentro do próprio anime, não "quem ganharia
uma luta". Evita debate infinito de comparação cross-anime.

| Tier | Critério |
|---|---|
| 1 | Personagem introdutório / suporte inicial |
| 2 | Membro competente do grupo principal |
| 3 | Especialista / vilão de arco médio |
| 4 | Braço direito do vilão principal / mestre |
| 5 | Antagonista final ou personagem "quebrado" da história |

## Qualidade (6 níveis, mesma cor dos itens de loot)

| Qualidade | Cor | Sinaliza |
|---|---|---|
| Comum | Cinza `#9aa3ad` | Personagem base, geralmente Tier 1-2 |
| Incomum | Verde `#5fb85f` | Suporte competente |
| Raro | Azul `#4a90d9` | Especialista com identidade forte |
| Épico | Roxo `#a86ede` | Braço direito / fã-favorito |
| Lendário | Laranja `#f0932b` | Antagonista final / marco do anime |
| Mítico | Vermelho `#e34a4a` | Ícone máximo do universo — 1-2 por anime, no máximo |

As cores são as mesmas já usadas nas molduras de raridade dos itens de
loot — reaproveitar o mesmo asset (moldura SVG), só trocando o ícone
interno pelo retrato do personagem.

## Estrelas

Cada Qualidade define a faixa de estrela ao desbloquear e o teto de
evolução:

| Qualidade | Estrelas ao desbloquear | Teto de evolução |
|---|---|---|
| Comum | ★1 | ★3 |
| Incomum | ★1 | ★4 |
| Raro | ★2 | ★5 |
| Épico | ★2 | ★6 |
| Lendário | ★3 | ★7 |
| Mítico | ★3 | ★8 |

### Evolução por duplicata

Fragmentos excedentes (depois do personagem já desbloqueado) evoluem
estrela em vez de serem vendidos direto:

- **10 fragmentos duplicados = +1 estrela**
- Cada estrela dá **+8% de dano / velocidade de caça**

> **TBD**: o comportamento ao atingir o teto de evolução não foi
> fechado. Duas opções na mesa:
> - Teto duro — fragmento excedente após o teto só pode ser vendido
> - Teto soft — continua evoluindo além do teto, com custo crescente
>   e ganho cada vez menor (diminishing returns)

## Fórmula de poder final

```
Poder final = Base do personagem
            × (1 + bônus de estrela)     // 8% por estrela
            × (1 + bônus de Potencial)   // ver potencial-ivs.md
```

Estrela e Potencial são multiplicadores **independentes** — não
interfira um no cálculo do outro.
