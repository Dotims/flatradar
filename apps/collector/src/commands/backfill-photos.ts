import type { Sql } from '../db/client.ts';
import { readNumber, readString, type DbRow } from '../db/rows.ts';
import { parseOlxOffer } from '../sources/olx/parse.ts';
import type { OlxOffer } from '../sources/olx/types.ts';
import { parseOtodomOffer } from '../sources/otodom/parse.ts';
import type { OtodomAdResponse, OtodomListItem } from '../sources/otodom/types.ts';

type OtodomAd = NonNullable<OtodomAdResponse['pageProps']['ad']>;

/** Enough to keep the round trips down, small enough that the payloads fit in memory. */
const BATCH = 200;

/**
 * Replays the parsers over stored payloads to fill `offers.photos` on rows written before
 * the column existed. This is the case `raw` is kept for: no portal is contacted.
 *
 * Rows are chosen by `photos = '[]'`, which is both the column default and a genuinely
 * empty gallery, so a listing that really has no photographs is read once per run and
 * then skipped by the id cursor rather than looping forever.
 */
export async function backfillPhotos(sql: Sql): Promise<{ read: number; filled: number }> {
  let cursor = 0;
  let read = 0;
  let filled = 0;

  for (;;) {
    const rows = await sql<DbRow[]>`
      select id, source, raw from offers
      where photos = '[]'::jsonb and id > ${cursor}
      order by id
      limit ${BATCH}
    `;

    if (rows.length === 0) break;

    for (const row of rows) {
      const id = readNumber(row, 'id');
      cursor = id;
      read++;

      const photos = photosFrom(readString(row, 'source'), row['raw']);
      if (photos.length === 0) continue;

      // sql.json, so the array is stored as an array. See the note in db/offers.ts.
      await sql`update offers set photos = ${sql.json(photos)} where id = ${id}`;
      filled++;
    }
  }

  return { read, filled };
}

/**
 * `raw` is declared jsonb but holds a JSON string rather than an object, so the driver
 * hands back a string and it takes one parse to get at the payload. That double encoding
 * is a defect in the write path and is worth fixing on its own; this reads it as it is.
 */
function photosFrom(source: string, stored: unknown): string[] {
  const payload: unknown = typeof stored === 'string' ? JSON.parse(stored) : stored;
  if (typeof payload !== 'object' || payload === null) return [];

  try {
    if (source === 'olx') return parseOlxOffer(payload as OlxOffer).photos;

    // An Otodom listing whose page was fetched is stored as { item, ad }; one that was
    // not is the search result on its own.
    const pair = payload as { item?: OtodomListItem; ad?: OtodomAd };
    if (pair.item === undefined) return [];
    return parseOtodomOffer(pair.item, pair.ad).photos;
  } catch {
    // A payload the current parser cannot read is a row to leave alone, not a run to
    // abandon: the shapes stored here span every version of the portals we have seen.
    return [];
  }
}
