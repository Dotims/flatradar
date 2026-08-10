import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.ts';
import type { Sql } from './client.ts';

/** Applies .sql files once each, in name order. A second run is a no-op. */
export async function migrate(
  sql: Sql,
  migrationsDir: string = config.migrationsDir,
): Promise<string[]> {
  await sql`
    create table if not exists schema_migrations (
      version    text primary key,
      applied_at timestamptz not null
    )
  `;

  const rows = await sql<{ version: string }[]>`select version from schema_migrations`;
  const applied = new Set(rows.map((row) => row.version));

  const pending = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .filter((name) => !applied.has(name));

  for (const name of pending) {
    const statements = readFileSync(join(migrationsDir, name), 'utf8');

    // One transaction per migration: it lands whole or not at all.
    await sql.begin(async (tx) => {
      await tx.unsafe(statements);
      await tx`insert into schema_migrations (version, applied_at) values (${name}, now())`;
    });
  }

  return pending;
}
