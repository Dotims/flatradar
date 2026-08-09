import { openDatabase, type Sql } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import {
  ADVERTISER_MATCH,
  DESCRIPTION_MATCH,
  DESCRIPTION_MATCH_SAME_ADVERTISER,
  TITLE_MATCH,
  TITLE_MATCH_SAME_ADVERTISER,
} from '../domain/duplicates.ts';
import type { DbRow } from '../db/rows.ts';
import { readNumber } from '../db/rows.ts';

/**
 * Marks each repeat of a flat with the listing worth showing instead.
 *
 * The comparison runs in Postgres because the blocking key is an index and pg_trgm's
 * similarity() is the same trigram measure the domain module implements: pulling four
 * thousand rows into Node to compare them pairwise would be the same arithmetic, slower
 * and further from the data.
 *
 * Which listing survives follows `preferred` in the domain module: an exact pin first,
 * then a description, then a private seller. Expressed here as an ordering so the choice
 * is made by the same query that finds the pairs.
 */
export async function dedupeOffers(sql: Sql): Promise<{ pairs: number; hidden: number }> {
  // Every run recomputes from scratch: thresholds change, and a listing that stops being
  // a duplicate has to come back.
  await sql`update offers set duplicate_of = null where duplicate_of is not null`;

  const rows = await sql<DbRow[]>`
    with ranked as (
      select id, price_pln, round(area_m2::numeric) as area, rooms, title, description,
             advertiser, coords_precision, is_private_owner,
             (case coords_precision when 'exact' then 2 when 'approximate' then 1 else 0 end) as pin,
             (case when description is null then 0 else 1 end) as has_text,
             (case when is_private_owner then 1 else 0 end) as private
      from offers
      where status = 'active' and price_pln is not null and area_m2 is not null
    ),
    pairs as (
      select a.id as keep_id, b.id as drop_id
      from ranked a
      join ranked b
        on a.price_pln = b.price_pln
       and a.area = b.area
       and coalesce(a.rooms, -1) = coalesce(b.rooms, -1)
       and (a.pin, a.has_text, a.private, a.id) > (b.pin, b.has_text, b.private, b.id)
      where
        similarity(lower(a.title), lower(b.title)) >= ${TITLE_MATCH}
        or (
          a.description is not null and b.description is not null
          and similarity(lower(a.description), lower(b.description)) >= ${DESCRIPTION_MATCH}
        )
        or (
          a.advertiser is not null and b.advertiser is not null
          and similarity(lower(a.advertiser), lower(b.advertiser)) >= ${ADVERTISER_MATCH}
          and (
            similarity(lower(a.title), lower(b.title)) >= ${TITLE_MATCH_SAME_ADVERTISER}
            or (
              a.description is not null and b.description is not null
              and similarity(lower(a.description), lower(b.description)) >=
                  ${DESCRIPTION_MATCH_SAME_ADVERTISER}
            )
          )
        )
    ),
    -- A flat advertised three times matches more than one partner, so each hidden
    -- listing points at the best of them rather than the first one found.
    best as (
      select distinct on (p.drop_id) p.drop_id, p.keep_id
      from pairs p
      join ranked k on k.id = p.keep_id
      order by p.drop_id, k.pin desc, k.has_text desc, k.private desc, k.id
    ),
    written as (
      update offers set duplicate_of = best.keep_id
      from best
      where offers.id = best.drop_id
      returning offers.id
    )
    select (select count(*) from pairs) as pairs, (select count(*) from written) as hidden
  `;

  // Whoever a hidden listing points at may itself have been hidden. Following the chain
  // to its end keeps every duplicate pointing at something the dashboard actually shows.
  for (let pass = 0; pass < 5; pass++) {
    const moved = await sql`
      update offers o set duplicate_of = target.duplicate_of
      from offers target
      where o.duplicate_of = target.id and target.duplicate_of is not null
        and target.duplicate_of <> o.id
    `;
    if (moved.count === 0) break;
  }

  // A pair that points at each other would survive the loop above as a two-cycle.
  await sql`
    update offers o set duplicate_of = null
    from offers other
    where o.duplicate_of = other.id and other.duplicate_of = o.id and o.id < other.id
  `;

  const row = rows[0];
  if (row === undefined) throw new Error('The deduplication query returned no summary.');

  const result = { pairs: readNumber(row, 'pairs'), hidden: readNumber(row, 'hidden') };
  console.log(`Deduplication: ${result.pairs} matching pairs, ${result.hidden} listings hidden.`);
  return result;
}

if (process.argv[1] === import.meta.filename) {
  const sql = openDatabase();
  try {
    await migrate(sql);
    await dedupeOffers(sql);
  } finally {
    await sql.end();
  }
}
