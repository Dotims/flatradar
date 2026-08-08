import type { Sql } from '../db/client.ts';
import { listClassifiedOffers, type ClassifiedOffer } from '../db/classifications.ts';
import { upsertOffer } from '../db/offers.ts';
import { listSourceStatus, type SourceStatus } from '../db/runs.ts';
import { classifyOffers } from '../commands/classify.ts';
import { collectOtodom } from '../commands/collect-otodom.ts';
import { parseOlxOffer } from '../sources/olx/parse.ts';
import type { OlxOffer } from '../sources/olx/types.ts';

/**
 * Guards the write endpoint. Fails closed: with no token configured nothing may write,
 * which is the safe way round for something reachable from the internet.
 */
export function assertIngestAllowed(presented: string | null): void {
  const expected = process.env.INGEST_TOKEN;
  if (expected === undefined || expected === '') {
    throw new Error('INGEST_TOKEN is not set, so writing is refused.');
  }
  if (presented !== expected) {
    throw new Error('Wrong or missing ingest token.');
  }
}

export interface SyncResult {
  source: string;
  seen: number;
  added: number;
  tiers: Record<string, number>;
}

export async function readOffers(
  sql: Sql,
): Promise<{ offers: ClassifiedOffer[]; sources: SourceStatus[] }> {
  const [offers, sources] = await Promise.all([listClassifiedOffers(sql), listSourceStatus(sql)]);
  return { offers, sources };
}

/** Otodom only: OLX refuses datacenter addresses, and this runs on one. */
export async function syncOtodom(sql: Sql): Promise<SyncResult> {
  const before = await countOffers(sql, 'otodom');
  await collectOtodom(sql);
  const after = await countOffers(sql, 'otodom');
  const tiers = await classifyOffers(sql);

  return { source: 'otodom', seen: after, added: after - before, tiers };
}

/**
 * Takes an OLX API response captured by a device on an ordinary connection, since the
 * portal will not answer this server. The device fetches, we parse and store.
 */
export async function ingestOlx(sql: Sql, body: unknown): Promise<SyncResult> {
  const offers = readOlxOffers(body);
  let added = 0;

  await sql.begin(async (tx) => {
    for (const offer of offers) {
      const result = await upsertOffer(tx, parseOlxOffer(offer));
      if (result.isNew) added++;
    }
  });

  const tiers = await classifyOffers(sql);
  return { source: 'olx', seen: offers.length, added, tiers };
}

function readOlxOffers(body: unknown): OlxOffer[] {
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    throw new Error('Expected an OLX API response with a data array.');
  }

  const { data } = body as { data: unknown };
  if (!Array.isArray(data)) throw new Error('The data field is not an array.');

  for (const item of data) {
    if (typeof item !== 'object' || item === null || !('id' in item) || !('params' in item)) {
      throw new Error('An entry does not look like an OLX offer.');
    }
  }

  return data as OlxOffer[];
}

async function countOffers(sql: Sql, source: string): Promise<number> {
  const [row] = await sql<{ total: string }[]>`
    select count(*) as total from offers where source = ${source}
  `;
  return Number(row?.total ?? 0);
}
