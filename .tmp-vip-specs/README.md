# Anime Idle World — Specs: Qualidade de Personagem & VIP

Documentação de implementação dos dois sistemas fechados em design.
Cada pasta tem um `.md` explicando a regra e um `.json` com os valores
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
```

## Status geral

Dois pontos ficaram em aberto na conversa e estão marcados como `TBD`
nos arquivos correspondentes — revisar antes de fechar a versão final:

1. **Teto de evolução de estrela**: duro (para no teto) ou infinito com
   diminishing returns depois do teto — não foi decidido.
2. **Alcance do bônus de +15% loot do VIP**: se aplica só na chance de
   "não dropar nada" (recomendado) ou em todas as raridades incluindo
   Lendário/Mítico — não foi decidido.

Tudo o mais neste pacote reflete decisões já fechadas na conversa.
