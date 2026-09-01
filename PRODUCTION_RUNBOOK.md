# Production runbook

## Supabase

1. Create a Supabase project for the deployment environment.
2. In Authentication → Providers → Email:
   - Enable Email provider.
   - Disable "Confirm email" unless you want verification (app currently
     allows sign-in without verification).
3. In Authentication → URL Configuration, set Site URL and Redirect URLs for
   localhost and every production domain (include
   `/auth/callback` and `/auth/reset-password`).
4. Set `DATABASE_URL` to the Transaction pooler connection string (port 6543)
   and `DATABASE_URL_UNPOOLED` to the Session/direct connection (port 5432).
5. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. Run `npm run db:migrate:social` with `DATABASE_URL_UNPOOLED` before
   promoting the application.
7. If a password or connection string was exposed, rotate it in Supabase and
   replace the Vercel variables.

The migrations are ordered through `0008_server_economy_events.sql`. They create
cloud saves, server-side guild kill budgets, shared API rate limits, and an
append-only ledger for server-delivered economy events.

## Vercel

Set the required variables for Production and Preview explicitly. Preview
deployments should use a separate Supabase project or branch-like database when
possible; do not set `DATABASE_URL_DEV` as a production fallback.

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SOCIAL_BACKEND=backend`

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

The optional `http-real` job also needs Supabase Auth secrets
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) plus
`HTTP_TEST_EMAIL` / `HTTP_TEST_PASSWORD`.
