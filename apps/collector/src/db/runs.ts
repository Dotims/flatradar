import type { Queryable } from './client.ts';
import type { OfferSource } from '../domain/offer.ts';
import {
  readNullableIso,
  readNullableBoolean,
  readNumber,
  readString,
  type DbRow,
} from './rows.ts';

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

export interface SourceStatus {
  source: string;
  lastCollectedAt: string | null;
  ok: boolean | null;
  itemsSeen: number;
}

/**
 * The last finished round per portal. The dashboard needs this because a page can be
 * freshly loaded from a database nobody has written to for hours.
 */
export async function listSourceStatus(sql: Queryable): Promise<SourceStatus[]> {
  const rows = await sql<DbRow[]>`
    select distinct on (source) source, finished_at, ok, items_seen
    from fetch_runs
    where finished_at is not null
    order by source, finished_at desc
  `;

  return rows.map((row) => ({
    source: readString(row, 'source'),
    lastCollectedAt: readNullableIso(row, 'finished_at'),
    ok: readNullableBoolean(row, 'ok'),
    itemsSeen: readNumber(row, 'items_seen'),
  }));
}
