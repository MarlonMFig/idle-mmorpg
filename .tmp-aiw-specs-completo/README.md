# Anime Idle World — Specs: Qualidade de Personagem, VIP, Guild & Loja Geral

Documentação de implementação dos sistemas fechados em design. Cada
pasta tem um `.md` explicando a regra e um `.json` com os valores
prontos pra virar tabela/config no código.

```
01-qualidade-personagens/
  qualidade-personagens.md   -> raridade do personagem, estrelas, evolução
  config-qualidade.json      -> tabelas de estrela por qualidade
  potencial-ivs.md           -> sistema equivalente a IV (Poder/Sorte/Fortuna)
  config-potencial.json      -> faixas ocultas e bônus por nota

02-vip/
  vip-assinatura.md          -> regras da assinatura mensal
  config-vip.json            -> valores/benefícios em formato config

03-guild/
  guild-sistema.md           -> moeda, progressão, árvore de passivas, loja de guild
  config-guild.json          -> valores em formato config

04-loja-geral/
  loja-geral.md              -> gemas, conquistas, missões, pacotes, passe, ofertas
  config-loja.json           -> valores em formato config
```

## Ordem de leitura sugerida

Se for implementar do zero, essa é a ordem de dependência entre os
sistemas:

1. **Qualidade de Personagem** — base de tudo (tier, estrela, potencial)
2. **Loja Geral** — economia de Gema, sem ela nada mais se conecta
3. **VIP** — depende da Loja Geral existir (é vendido lá)
4. **Guild** — depende de VIP (criação é exclusiva de assinante) e
   de Fragmento (que a loja de guild vende)

## Status geral — pontos em aberto (TBD)

Marcados nos arquivos correspondentes, não decididos na conversa:

1. **Teto de evolução de estrela** (`01-qualidade-personagens`): duro
   ou infinito com diminishing returns depois do teto.
2. **Alcance do bônus de +15% loot do VIP** (`02-vip`): só na chance
   de "não dropar nada" (recomendado) ou em todas as raridades
   incluindo Lendário/Mítico.
3. **Reset de pontos do líder de guild** (`03-guild`): se é permitido,
   e se tem custo em Gemas ou é livre.
4. **Teto combinado de bônus VIP + Guild** (`03-guild`): recomendação
   de +40% máximo somando EXP/loot dos dois sistemas, não fechado
   como regra definitiva.
5. **Preço em R$ da assinatura VIP** (`02-vip` / `04-loja-geral`): não
   definido neste pacote.

Revisar esses cinco pontos antes de considerar a economia
"congelada" pra produção.
