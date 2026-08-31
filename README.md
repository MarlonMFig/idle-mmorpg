# Naruto World Idle

Idle MMORPG com Next.js 16, React, TypeScript, Tailwind, Phaser 3, Neon
Postgres/Auth e multiplayer opcional via PartyKit.

## Stack

- Next.js 16 (App Router)
- React + TypeScript
- Tailwind CSS
- Phaser 3
- Neon Auth (email e senha)
- Drizzle ORM + Neon Postgres
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

## Desenvolvimento

```bash
npm run dev
```

Sem banco local, o backend social usa PGlite em memória. Para testar autenticação,
save em nuvem e APIs sociais, configure `.env.local` a partir de `.env.example`.

## Produção

Configure no Vercel:

- `DATABASE_URL`: conexão pooled do Neon para runtime.
- `DATABASE_URL_UNPOOLED`: conexão direta usada apenas por migrações.
- `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` e `NEON_AUTH_JWKS_URL`.
- `NEXT_PUBLIC_APP_URL`: URL canônica da aplicação.
- `MULTIPLAYER_AUTH_SECRET`: segredo compartilhado com o worker PartyKit, se usado.
- `NEXT_PUBLIC_PARTYKIT_HOST`: host PartyKit publicado, se usado.

`DATABASE_URL_DEV`, `SOCIAL_USE_DEV_DB` e `ISOLATE_SOCIAL_DEV` são somente DEV e
são rejeitados/ignorados em produção. Nunca copie uma senha do Neon para o
repositório; se uma credencial foi exposta, faça rotação no Neon antes do deploy.

Após provisionar o banco, aplique as migrações:

```bash
npm run db:migrate:social
```

O save do jogo é salvo localmente para resposta imediata e sincronizado em
`player_saves`, sempre vinculado ao jogador autenticado. Ranking, bosses, guild
XP e Guild Shop passam por validação e limites no servidor.

## Multiplayer

```bash
npm run party:dev
npm run party:deploy
```

O cliente solicita um token curto em `/api/multiplayer/token`; o worker PartyKit
deve receber o mesmo `MULTIPLAYER_AUTH_SECRET`. Em produção sem host configurado,
o jogo mostra multiplayer indisponível em vez de simular uma conexão.

## Verificação

```bash
npm run lint
npm run typecheck
npm run build
npm run test:critical
npm run social:test
```
