import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageRoot, '../..');

export const config = {
  /** Database file. Override with FLATRADAR_DB, which is handy in tests. */
  databasePath: process.env.FLATRADAR_DB ?? resolve(repoRoot, 'data/flatradar.db'),
  migrationsDir: resolve(packageRoot, 'src/db/migrations'),
} as const;
