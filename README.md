# Idle MMORPG

Estrutura inicial (Next.js 15 + React + TypeScript + Tailwind + Phaser 3).

## Stack

- Next.js 15 (App Router)
- React + TypeScript
- Tailwind CSS
- Phaser 3
- ESLint + Prettier

## Estrutura

```
src/
  app/          # rotas Next.js (App Router)
  game/         # bootstrap / cenas Phaser
  components/   # componentes React reutilizáveis
  assets/       # assets estáticos tipados / refs
  maps/         # dados e loaders de mapas
  entities/     # entidades do jogo
  systems/      # sistemas (ECS / gameplay)
  ui/           # HUD e overlays React
  hooks/        # React hooks
  services/     # API / rede / persistência
  stores/       # estado cliente
  utils/        # helpers
  types/        # tipos compartilhados
  constants/    # constantes
  data/         # dados estáticos (itens, defs)
```

Alias: `@/*` → `src/*`

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run format
```

Nenhuma funcionalidade de jogo está implementada nesta etapa.
