import { defineConfig } from 'drizzle-kit';

/** Drizzle Kit — schema social Item 37. */
export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.DATABASE_URL_DEV || 'postgresql://localhost:5432/idle_mmorpg',
  },
});
