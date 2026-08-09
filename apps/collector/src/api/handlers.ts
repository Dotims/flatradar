import type { Sql } from '../db/client.ts';
import { listClassifiedOffers, type ClassifiedOffer } from '../db/classifications.ts';
import { listMarks, setMark, toMark, type Mark } from '../db/marks.ts';
import { upsertOffer } from '../db/offers.ts';
import { readOfferDetail, type OfferDetail } from '../db/offer-detail.ts';
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

export interface MarkedOffer extends ClassifiedOffer {
  mark: Mark | null;
}

export async function readOffers(
  sql: Sql,
): Promise<{ offers: MarkedOffer[]; sources: SourceStatus[] }> {
  const [offers, sources, marks] = await Promise.all([
    listClassifiedOffers(sql),
    listSourceStatus(sql),
    listMarks(sql),
  ]);

  return {
    offers: offers.map((offer) => ({ ...offer, mark: marks.get(offer.id) ?? null })),
    sources,
  };
}

/** The owner's own verdict on one listing. `null` clears it. */
export async function writeMark(sql: Sql, id: number, mark: Mark | null): Promise<void> {
  await setMark(sql, id, mark);
}

/** Anything but the three accepted words is a bad request, not a silent no-op. */
export function readMark(body: unknown): Mark | null {
  if (typeof body !== 'object' || body === null || !('mark' in body)) {
    throw new Error('Expected a body with a mark field.');
  }

  const { mark } = body as { mark: unknown };
  if (mark === null) return null;
  if (typeof mark !== 'string') throw new Error('The mark must be a string or null.');
  return toMark(mark);
}

/** One listing in full: description and photos, too heavy for the list payload. */
export async function readDetail(sql: Sql, id: number): Promise<OfferDetail | null> {
  return readOfferDetail(sql, id);
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
