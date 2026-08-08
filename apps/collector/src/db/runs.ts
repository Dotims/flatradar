import type { Queryable } from './client.ts';
import type { OfferSource } from '../domain/offer.ts';
import { readNumber, type DbRow } from './rows.ts';

export interface RunSummary {
  itemsSeen: number;
  itemsNew: number;
  error?: string;
}

export async function startRun(sql: Queryable, source: OfferSource): Promise<number> {
  const [row] = await sql<DbRow[]>`
    insert into fetch_runs (source, started_at) values (${source}, now()) returning id
  `;

  if (row === undefined) throw new Error('The insert returned no run id.');
  return readNumber(row, 'id');
}

export async function finishRun(sql: Queryable, runId: number, summary: RunSummary): Promise<void> {
  await sql`
    update fetch_runs
    set finished_at = now(), ok = ${summary.error === undefined},
        items_seen = ${summary.itemsSeen}, items_new = ${summary.itemsNew},
        error = ${summary.error ?? null}
    where id = ${runId}
  `;
}
