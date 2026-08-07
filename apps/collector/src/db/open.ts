import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.ts';

export function openDatabase(path: string = config.databasePath): DatabaseSync {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new DatabaseSync(path);

  // WAL lets the dashboard read while the collector is writing.
  db.exec('pragma journal_mode = wal');
  // SQLite does not enforce foreign keys unless told to, per connection.
  db.exec('pragma foreign_keys = on');
  // Wait five seconds for a busy database instead of failing immediately.
  db.exec('pragma busy_timeout = 5000');

  return db;
}
