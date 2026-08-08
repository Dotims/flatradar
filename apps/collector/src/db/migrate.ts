import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { config } from '../config.ts';
import { openDatabase } from './open.ts';

/** Applies .sql files once each, in name order. A second run is a no-op. */
export function migrate(db: DatabaseSync, migrationsDir: string = config.migrationsDir): string[] {
  db.exec(`
    create table if not exists schema_migrations (
      version    text primary key,
      applied_at text not null
    )
  `);

  const applied = new Set(
    db
      .prepare('select version from schema_migrations')
      .all()
      .map((row) => String(row.version)),
  );

  const pending = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .filter((name) => !applied.has(name));

  for (const name of pending) {
    const sql = readFileSync(join(migrationsDir, name), 'utf8');

    // One transaction per migration: it lands whole or not at all.
    db.exec('begin');
    try {
      db.exec(sql);
      db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(
        name,
        new Date().toISOString(),
      );
      db.exec('commit');
    } catch (error) {
      db.exec('rollback');
      throw new Error(`Migration ${name} failed: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  return pending;
}

// Direct run: node src/db/migrate.ts
if (process.argv[1] === import.meta.filename) {
  const db = openDatabase();
  const applied = migrate(db);
  db.close();

  console.log(
    applied.length === 0
      ? 'Database up to date, no migrations to apply.'
      : `Applied migrations: ${applied.join(', ')}`,
  );
}
