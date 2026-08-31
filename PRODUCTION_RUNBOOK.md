# Production runbook

## Neon

1. Create a Neon branch dedicated to the deployment environment.
2. Set `DATABASE_URL` to the pooled connection and
   `DATABASE_URL_UNPOOLED` to the direct connection.
3. Run `npm run db:migrate:social` with
   `DATABASE_URL_UNPOOLED` before promoting the application.
4. Configure Neon Auth trusted origins for localhost and every production
   domain that serves the app.
5. If a password or connection string was exposed, rotate it in Neon and
   replace the Vercel variables.

The migrations are ordered through `0008_server_economy_events.sql`. They create
cloud saves, server-side guild kill budgets, shared API rate limits, and an
append-only ledger for server-delivered economy events.

## Vercel

Set the required variables for Production and Preview explicitly. Preview
deployments should use a separate Neon branch and database URL; do not set
`DATABASE_URL_DEV` as a production fallback.

Redeploy after changing variables. A redeploy without a new build does not
repair missing or stale environment values.

## PartyKit

Set the same `MULTIPLAYER_AUTH_SECRET` in the PartyKit worker and the Vercel
application, then deploy the worker with `npm run party:deploy`. Set
`NEXT_PUBLIC_PARTYKIT_HOST` to the published host. Without this host the
production client reports multiplayer as unavailable.

## Verification

Run locally or in CI:

```bash
npm run typecheck
npm run lint
npm run build
npm run test:critical
npm run social:test
```

The optional `social-real` CI job runs migrations and the social backend tests
when `DATABASE_URL` and `DATABASE_URL_UNPOOLED` repository secrets are present.
