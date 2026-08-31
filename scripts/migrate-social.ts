import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const MIGRATIONS = [
  '0001_social.sql',
  '0002_world_boss.sql',
  '0003_guild_shop.sql',
  '0004_neon_auth_players.sql',
  '0005_player_saves.sql',
  '0006_guild_online_kill_limits.sql',
  '0007_api_rate_limits.sql',
] as const;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL_UNPOOLED?.trim();
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL_UNPOOLED é obrigatório para migrações. Não use DATABASE_URL_DEV nem localhost.',
    );
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS social_schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const applied = await client.query<{ version: string }>(
      'SELECT version FROM social_schema_migrations',
    );
    const appliedVersions = new Set(applied.rows.map((row) => row.version));

    for (const version of MIGRATIONS) {
      if (appliedVersions.has(version)) {
        console.info(`[social-migrate] já aplicada: ${version}`);
        continue;
      }

      const sql = await readFile(path.resolve(process.cwd(), 'drizzle', version), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO social_schema_migrations (version) VALUES ($1)', [version]);
      console.info(`[social-migrate] aplicada: ${version}`);
    }

    await client.query('COMMIT');
    console.info('[social-migrate] banco social atualizado com sucesso.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('[social-migrate] falhou:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
