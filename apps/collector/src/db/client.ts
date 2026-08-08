import postgres from 'postgres';
import { config } from '../config.ts';

export type Sql = postgres.Sql;
/** Sql and TransactionSql share this. Query helpers take it so they work inside a transaction. */
export type Queryable = postgres.ISql;

/**
 * Neon closes idle connections and sleeps the database, so the pool stays small and
 * gives up rather than hanging when something is wrong.
 */
export function openDatabase(url: string = config.databaseUrl()): Sql {
  return postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    // "table already exists, skipping" on every idempotent migration run.
    onnotice: () => {},
  });
}
