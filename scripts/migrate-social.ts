import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

const MIGRATIONS = [
  '0001_social.sql',
  '0002_world_boss.sql',
  '0003_guild_shop.sql',
  '0004_neon_auth_players.sql',
  '0005_player_saves.sql',
  '0006_guild_online_kill_limits.sql',
  '0007_api_rate_limits.sql',
  '0008_server_economy_events.sql',
] as const;

async function main(): Promise<void> {
  const databaseUrl = (process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL)?.trim();
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL_UNPOOLED é obrigatório para migrações. Não use DATABASE_URL_DEV nem localhost.',
    );
  }

  const sql = postgres(databaseUrl, { max: 1, prepare: false });

  try {
    await sql.begin(async (tx) => {
      await tx`
        CREATE TABLE IF NOT EXISTS social_schema_migrations (
          version text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `;

      const applied = await tx<{ version: string }[]>`
        SELECT version FROM social_schema_migrations
      `;
      const appliedVersions = new Set(applied.map((row) => row.version));

      for (const version of MIGRATIONS) {
        if (appliedVersions.has(version)) {
          console.info(`[social-migrate] já aplicada: ${version}`);
          continue;
        }

        const migrationSql = await readFile(
          path.resolve(process.cwd(), 'drizzle', version),
          'utf8',
        );
        await tx.unsafe(migrationSql);
        await tx`INSERT INTO social_schema_migrations (version) VALUES (${version})`;
        console.info(`[social-migrate] aplicada: ${version}`);
      }
    });

    console.info('[social-migrate] banco social atualizado com sucesso.');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error('[social-migrate] falhou:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
