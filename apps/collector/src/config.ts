import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Read from .env via `node --env-file`, or from the environment in CI and on Vercel. */
function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL is not set. Put the Neon connection string in .env.');
  }
  return url;
}

export const config = {
  databaseUrl,
  migrationsDir: resolve(packageRoot, 'src/db/migrations'),
} as const;
