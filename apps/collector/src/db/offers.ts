import type { CoordsPrecision, NormalizedOffer, OfferSource } from '../domain/offer.ts';
import type { Queryable } from './client.ts';
import {
  readNullableBoolean,
  readNullableIso,
  readNullableNumber,
  readNullableString,
  readNumber,
  readString,
  type DbRow,
} from './rows.ts';

export interface UpsertResult {
  offerId: number;
  isNew: boolean;
  priceChanged: boolean;
}

/** Enough to decide insert vs update. */
interface ExistingOffer {
  id: number;
  pricePln: number | null;
  rentPln: number | null;
}

async function findExisting(
  sql: Queryable,
  source: string,
  sourceId: string,
): Promise<ExistingOffer | undefined> {
  const [row] = await sql<DbRow[]>`
    select id, price_pln, rent_pln from offers
    where source = ${source} and source_id = ${sourceId}
  `;

  if (row === undefined) return undefined;

  return {
    id: readNumber(row, 'id'),
    pricePln: readNullableNumber(row, 'price_pln'),
    rentPln: readNullableNumber(row, 'rent_pln'),
  };
}

export interface UpsertOptions {
  now?: string;
  /**
   * Set when the listing page was deliberately not read, so `offer` carries no
   * description, pin, advertiser or full payload. Without it the update would write
   * those nulls over detail we already paid a request for.
   */
  preserveDetail?: boolean;
}

export async function upsertOffer(
  sql: Queryable,
  offer: NormalizedOffer,
  { now = new Date().toISOString(), preserveDetail = false }: UpsertOptions = {},
): Promise<UpsertResult> {
  const existing = await findExisting(sql, offer.source, offer.sourceId);

  /*
    sql.json, not JSON.stringify. A string bound to a jsonb column is encoded as a JSON
    string, so stringifying first stores the scalar "[\"a.jpg\"]" rather than the array,
    and every jsonb operator then either returns null or fails outright:
    jsonb_array_length(photos) errors with "cannot get array length of a scalar".

    This is why `raw` reads back as text and needs unwrapping. Both columns are written
    properly from here on; rows already stored keep the old shape, and the one reader of
    `raw` copes with either.
  */
  const raw = sql.json(offer.raw as Parameters<typeof sql.json>[0]);
  const photos = sql.json(offer.photos);

  if (existing === undefined) {
    const [row] = await sql<DbRow[]>`
      insert into offers (
        source, source_id, url, title, description,
        price_pln, rent_pln, deposit_pln,
        area_m2, rooms, floor,
        city, district, subdistrict, street, lat, lng, coords_precision,
        is_private_owner, advertiser, status,
        created_at_source, pushed_up_at, first_seen_at, last_seen_at, photos, raw
      ) values (
        ${offer.source}, ${offer.sourceId}, ${offer.url}, ${offer.title}, ${offer.description},
        ${offer.pricePln}, ${offer.rentPln}, ${offer.depositPln},
        ${offer.areaM2}, ${offer.rooms}, ${offer.floor},
        ${offer.city}, ${offer.district}, ${offer.subdistrict}, ${offer.street},
        ${offer.lat}, ${offer.lng}, ${offer.coordsPrecision},
        ${offer.isPrivateOwner}, ${offer.advertiser}, ${offer.status},
        ${offer.createdAtSource}, ${offer.pushedUpAt}, ${now}, ${now}, ${photos}, ${raw}
      )
      returning id
    `;

    if (row === undefined) throw new Error('The insert returned no id.');
    const offerId = readNumber(row, 'id');
    await insertPriceHistory(sql, offerId, offer, now);
    return { offerId, isNew: true, priceChanged: false };
  }

  // Only what an advertiser can edit. first_seen_at is ours, not the portal's.
  if (preserveDetail) {
    await sql`
      update offers set
        url = ${offer.url}, title = ${offer.title},
        price_pln = ${offer.pricePln}, rent_pln = ${offer.rentPln},
        deposit_pln = ${offer.depositPln},
        area_m2 = ${offer.areaM2}, rooms = ${offer.rooms}, floor = ${offer.floor},
        is_private_owner = ${offer.isPrivateOwner}, status = ${offer.status},
        pushed_up_at = ${offer.pushedUpAt}, last_seen_at = ${now}
      where id = ${existing.id}
    `;
  } else {
    await sql`
      update offers set
        url = ${offer.url}, title = ${offer.title}, description = ${offer.description},
        price_pln = ${offer.pricePln}, rent_pln = ${offer.rentPln},
        deposit_pln = ${offer.depositPln},
        area_m2 = ${offer.areaM2}, rooms = ${offer.rooms}, floor = ${offer.floor},
        district = ${offer.district}, subdistrict = ${offer.subdistrict}, street = ${offer.street},
        lat = ${offer.lat}, lng = ${offer.lng}, coords_precision = ${offer.coordsPrecision},
        is_private_owner = ${offer.isPrivateOwner}, advertiser = ${offer.advertiser},
        status = ${offer.status},
        pushed_up_at = ${offer.pushedUpAt}, last_seen_at = ${now},
        photos = ${photos}, raw = ${raw}
      where id = ${existing.id}
    `;
  }

  const priceChanged = existing.pricePln !== offer.pricePln || existing.rentPln !== offer.rentPln;
  if (priceChanged) {
    await insertPriceHistory(sql, existing.id, offer, now);
  }

  return { offerId: existing.id, isNew: false, priceChanged };
}

async function insertPriceHistory(
  sql: Queryable,
  offerId: number,
  offer: NormalizedOffer,
  seenAt: string,
): Promise<void> {
  await sql`
    insert into price_history (offer_id, price_pln, rent_pln, seen_at)
    values (${offerId}, ${offer.pricePln}, ${offer.rentPln}, ${seenAt})
  `;
}

/** A listing read back out, carrying its row id. */
export interface StoredOffer extends NormalizedOffer {
  id: number;
}

// The check constraints live in Postgres, the types live here. Verify rather than assume.
function toSource(value: string): OfferSource {
  if (value === 'olx' || value === 'otodom') return value;
  throw new Error(`Unknown offer source "${value}".`);
}

function toStatus(value: string): NormalizedOffer['status'] {
  if (value === 'active' || value === 'expired') return value;
  throw new Error(`Unknown offer status "${value}".`);
}

function toCoordsPrecision(value: string | null): CoordsPrecision | null {
  if (value === null || value === 'exact' || value === 'approximate') return value;
  throw new Error(`Unknown coordinate precision "${value}".`);
}

function toStoredOffer(row: DbRow): StoredOffer {
  return {
    id: readNumber(row, 'id'),
    source: toSource(readString(row, 'source')),
    sourceId: readString(row, 'source_id'),
    url: readString(row, 'url'),
    title: readString(row, 'title'),
    description: readNullableString(row, 'description'),
    pricePln: readNullableNumber(row, 'price_pln'),
    rentPln: readNullableNumber(row, 'rent_pln'),
    depositPln: readNullableNumber(row, 'deposit_pln'),
    areaM2: readNullableNumber(row, 'area_m2'),
    rooms: readNullableNumber(row, 'rooms'),
    floor: readNullableString(row, 'floor'),
    city: readString(row, 'city'),
    district: readNullableString(row, 'district'),
    subdistrict: readNullableString(row, 'subdistrict'),
    street: readNullableString(row, 'street'),
    lat: readNullableNumber(row, 'lat'),
    lng: readNullableNumber(row, 'lng'),
    coordsPrecision: toCoordsPrecision(readNullableString(row, 'coords_precision')),
    isPrivateOwner: readNullableBoolean(row, 'is_private_owner'),
    advertiser: readNullableString(row, 'advertiser'),
    status: toStatus(readString(row, 'status')),
    createdAtSource: readNullableIso(row, 'created_at_source'),
    pushedUpAt: readNullableIso(row, 'pushed_up_at'),
    // Neither is selected: classification reads the numbers and the description, and
    // would otherwise drag every stored payload and gallery through with them.
    photos: [],
    raw: null,
  };
}

/**
 * Listings whose detail page has already been read. The backfill walks thousands of
 * results and the listing page costs a request each, so anything already carrying a
 * description and a pin is left alone.
 */
export async function listDetailedSourceIds(
  sql: Queryable,
  source: OfferSource,
): Promise<Set<string>> {
  const rows = await sql<DbRow[]>`
    select source_id from offers
    where source = ${source} and description is not null and lat is not null
  `;

  return new Set(rows.map((row) => readString(row, 'source_id')));
}

/** Listings with no verdict or an outdated one. Bumping RULES_VERSION reclassifies all. */
export async function listOffersToClassify(
  sql: Queryable,
  rulesVersion: number,
): Promise<StoredOffer[]> {
  const rows = await sql<DbRow[]>`
    select o.id, o.source, o.source_id, o.url, o.title, o.description,
           o.price_pln, o.rent_pln, o.deposit_pln, o.area_m2, o.rooms, o.floor,
           o.city, o.district, o.subdistrict, o.street, o.lat, o.lng, o.coords_precision,
           o.is_private_owner, o.advertiser, o.status, o.created_at_source, o.pushed_up_at
    from offers o
    left join classifications c on c.offer_id = o.id
    where c.offer_id is null or c.rules_version <> ${rulesVersion}
    order by o.id
  `;

  return rows.map(toStoredOffer);
}
