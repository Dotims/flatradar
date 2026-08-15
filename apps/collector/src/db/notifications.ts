import type { CostCertainty } from '../domain/classify.ts';
import type { Queryable, Sql } from './client.ts';
import {
  readNullableBoolean,
  readNullableNumber,
  readNullableString,
  readNumber,
  readString,
  type DbRow,
} from './rows.ts';

/** Telegram is the only channel; the column exists so a second one needs no migration. */
const CHANNEL = 'telegram';

/**
 * What a message is built from. Deliberately narrower than `ClassifiedOffer`: a
 * notification carries no photographs, no coordinates and no reasons list, and asking the
 * database for them every round would be work nobody reads.
 */
export interface NotifiableOffer {
  id: number;
  source: string;
  url: string;
  title: string;
  district: string | null;
  areaM2: number | null;
  rooms: number | null;
  floor: string | null;
  pricePln: number | null;
  rentPln: number | null;
  totalCostPln: number | null;
  costCertainty: CostCertainty;
  isPrivateOwner: boolean | null;
  /** The first one only. A notification shows one picture; the rest are a tap away. */
  photo: string | null;
}

function toCertainty(value: string): CostCertainty {
  if (value === 'exact' || value === 'all_in' || value === 'estimated' || value === 'uncertain') {
    return value;
  }
  throw new Error(`Unknown cost certainty "${value}".`);
}

function toNotifiableOffer(row: DbRow): NotifiableOffer {
  return {
    id: readNumber(row, 'id'),
    source: readString(row, 'source'),
    url: readString(row, 'url'),
    title: readString(row, 'title'),
    district: readNullableString(row, 'district'),
    areaM2: readNullableNumber(row, 'area_m2'),
    rooms: readNullableNumber(row, 'rooms'),
    floor: readNullableString(row, 'floor'),
    pricePln: readNullableNumber(row, 'price_pln'),
    rentPln: readNullableNumber(row, 'rent_pln'),
    totalCostPln: readNullableNumber(row, 'total_cost_pln'),
    costCertainty: toCertainty(readString(row, 'cost_certainty')),
    isPrivateOwner: readNullableBoolean(row, 'is_private_owner'),
    photo: readNullableString(row, 'photo'),
  };
}

/**
 * Worth waking a phone for: in budget, still advertised, and not the second copy of a
 * flat already announced from the other portal.
 *
 * One definition, interpolated into both queries below. Written twice it would eventually
 * be changed once, and a seed that disagrees with the send means either a silent gap or
 * several hundred messages about flats the owner scrolled past last week.
 *
 * Districts are not filtered here on purpose: they are a dashboard filter rather than a
 * rule, and a flat in budget is worth knowing about wherever it is.
 */
function eligible(sql: Sql) {
  return sql`c.tier = 'top' and o.status = 'active' and o.duplicate_of is null`;
}

/**
 * The listings in budget that have never been announced. Oldest first, so a backlog
 * arrives in the order the flats appeared rather than newest-first and backwards.
 */
export async function listOffersToNotify(sql: Sql, limit: number): Promise<NotifiableOffer[]> {
  const rows = await sql<DbRow[]>`
    select o.id, o.source, o.url, o.title, o.district, o.area_m2, o.rooms, o.floor,
           o.price_pln, o.rent_pln, o.is_private_owner,
           -- ->> 0 is null on an empty array, which is exactly the "no photograph" case.
           o.photos ->> 0 as photo,
           c.total_cost_pln, c.cost_certainty
    from classifications c
    join offers o on o.id = c.offer_id
    where ${eligible(sql)}
      and not exists (
        select 1 from notifications n
        where n.offer_id = o.id and n.channel = ${CHANNEL}
      )
    order by o.first_seen_at
    limit ${limit}
  `;

  return rows.map(toNotifiableOffer);
}

/**
 * Recorded per listing rather than per round, and written only after Telegram has
 * accepted the message. A crash halfway through a batch costs a repeat of nothing.
 */
export async function markNotified(sql: Queryable, offerId: number): Promise<void> {
  await sql`
    insert into notifications (offer_id, channel, sent_at)
    values (${offerId}, ${CHANNEL}, now())
    on conflict (offer_id, channel) do nothing
  `;
}

/**
 * Draws a line under everything already collected: every listing that qualifies right now
 * is recorded as announced, without a message being sent.
 *
 * This is what makes switching the notifier on survivable. The database holds 549 listings
 * in budget gathered over a week of collecting, and the owner has already seen them in the
 * dashboard; without this the first round would send 549 messages in a row and the bot
 * would be muted before it ever reported a flat that mattered.
 */
export async function markEverythingNotified(sql: Sql): Promise<number> {
  const rows = await sql<DbRow[]>`
    insert into notifications (offer_id, channel, sent_at)
    select o.id, ${CHANNEL}, now()
    from classifications c
    join offers o on o.id = c.offer_id
    where ${eligible(sql)}
    on conflict (offer_id, channel) do nothing
    returning offer_id
  `;

  return rows.length;
}
