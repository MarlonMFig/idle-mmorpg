/**
 * DB client — Neon Pool (transações) ou PGlite isolado (DEV/test).
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import ws from 'ws';
import * as schema from '@/server/db/schema';
import { SOCIAL_SCHEMA_SQL } from '@/server/db/schema-sql';

neonConfig.webSocketConstructor = ws;

export type SocialDb =
  | ReturnType<typeof drizzleNeon<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>;

let cached: SocialDb | null = null;
let pgliteInstance: PGlite | null = null;
let migratedPglite = false;
let pool: Pool | null = null;

export async function ensurePgliteMigrated(client: PGlite): Promise<void> {
  if (migratedPglite) return;
  await client.exec(SOCIAL_SCHEMA_SQL);
  migratedPglite = true;
}

export async function getSocialDb(opts?: { forcePglite?: boolean }): Promise<SocialDb> {
  if (opts?.forcePglite) {
    if (!pgliteInstance) pgliteInstance = new PGlite();
    await ensurePgliteMigrated(pgliteInstance);
    return drizzlePglite(pgliteInstance, { schema });
  }

  if (cached) return cached;

  const isProd = process.env.NODE_ENV === 'production';
  const useDevUrl = process.env.SOCIAL_USE_DEV_DB === '1' || process.env.ISOLATE_SOCIAL_DEV === '1';
  const url = useDevUrl
    ? process.env.DATABASE_URL_DEV || process.env.DATABASE_URL
    : process.env.DATABASE_URL || process.env.DATABASE_URL_DEV;

  if (url) {
    pool = new Pool({ connectionString: url });
    cached = drizzleNeon(pool, { schema });
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
  if (pool) {
    void pool.end();
    pool = null;
  }
}

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_DEV);
}
