import { defineConfig } from 'drizzle-kit';

/** Drizzle Kit — schema social. */
const isProduction = process.env.NODE_ENV === 'production';
const url = isProduction
  ? process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL
  : process.env.DATABASE_URL_UNPOOLED ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_URL_DEV ||
    'postgresql://localhost:5432/idle_mmorpg';

if (isProduction && !url) {
  throw new Error('DATABASE_URL_UNPOOLED é obrigatório em produção.');
}

export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url,
  },
});
