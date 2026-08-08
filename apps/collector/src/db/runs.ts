import type { DatabaseSync } from 'node:sqlite';
import type { OfferSource } from '../domain/offer.ts';

export interface RunSummary {
  itemsSeen: number;
  itemsNew: number;
  error?: string;
}

export function startRun(db: DatabaseSync, source: OfferSource): number {
  const result = db
    .prepare('insert into fetch_runs (source, started_at) values (?, ?)')
    .run(source, new Date().toISOString());
  return Number(result.lastInsertRowid);
}

export function finishRun(db: DatabaseSync, runId: number, summary: RunSummary): void {
  db.prepare(
    `update fetch_runs
     set finished_at = ?, ok = ?, items_seen = ?, items_new = ?, error = ?
     where id = ?`,
  ).run(
    new Date().toISOString(),
    summary.error === undefined ? 1 : 0,
    summary.itemsSeen,
    summary.itemsNew,
    summary.error ?? null,
    runId,
  );
}
