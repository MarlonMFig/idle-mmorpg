/**
 * DB client — Postgres (Supabase) via postgres.js, ou PGlite isolado (DEV/test).
 */

import postgres from 'postgres';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from '@/server/db/schema';
import { SOCIAL_SCHEMA_SQL } from '@/server/db/schema-sql';

export type SocialDb =
  | ReturnType<typeof drizzlePostgres<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>;

let cached: SocialDb | null = null;
let pgliteInstance: PGlite | null = null;
let migratedPglite = false;
let sqlClient: ReturnType<typeof postgres> | null = null;

export async function ensurePgliteMigrated(client: PGlite): Promise<void> {
  if (migratedPglite) return;
  await client.exec(SOCIAL_SCHEMA_SQL);
  migratedPglite = true;
}

function resolveDatabaseUrl(): string | undefined {
  const isProd = process.env.NODE_ENV === 'production';
  const useDevUrl = process.env.SOCIAL_USE_DEV_DB === '1' || process.env.ISOLATE_SOCIAL_DEV === '1';
  if (isProd) return process.env.DATABASE_URL;
  if (useDevUrl) return process.env.DATABASE_URL_DEV || process.env.DATABASE_URL;
  return process.env.DATABASE_URL || process.env.DATABASE_URL_DEV;
}

export async function getSocialDb(opts?: { forcePglite?: boolean }): Promise<SocialDb> {
  if (opts?.forcePglite) {
    if (!pgliteInstance) pgliteInstance = new PGlite();
    await ensurePgliteMigrated(pgliteInstance);
    return drizzlePglite(pgliteInstance, { schema });
  }

  if (cached) return cached;

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && (process.env.SOCIAL_USE_DEV_DB === '1' || process.env.ISOLATE_SOCIAL_DEV === '1')) {
    throw new Error('Flags de banco DEV não podem ser usadas em produção.');
  }
  if (isProd && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL ausente em produção — social backend indisponível.');
  }

  const url = resolveDatabaseUrl();

  if (url) {
    // prepare: false is required for Supabase transaction pooler (PgBouncer).
    sqlClient = postgres(url, { prepare: false, max: 10 });
    cached = drizzlePostgres(sqlClient, { schema });
    return cached;
  }

  if (isProd) {
    throw new Error('DATABASE_URL ausente em produção — social backend indisponível.');
  }

  if (!pgliteInstance) pgliteInstance = new PGlite();
  await ensurePgliteMigrated(pgliteInstance);
  cached = drizzlePglite(pgliteInstance, { schema });
  return cached;
}

export async function createTestSocialDb(): Promise<{ db: SocialDb; client: PGlite }> {
  const client = new PGlite();
  await client.exec(SOCIAL_SCHEMA_SQL);
  const db = drizzlePglite(client, { schema });
  return { db, client };
}

export function resetSocialDbCache(): void {
  cached = null;
  pgliteInstance = null;
  migratedPglite = false;
  if (sqlClient) {
    void sqlClient.end({ timeout: 5 });
    sqlClient = null;
  }
}

export function hasDatabaseUrl(): boolean {
  if (process.env.NODE_ENV === 'production') return Boolean(process.env.DATABASE_URL);
  return Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_DEV);
}
