import type { DatabaseSync } from 'node:sqlite';
import type { NormalizedOffer } from '../domain/offer.ts';
import { readNullableNumber, readNumber } from './rows.ts';

export interface UpsertResult {
  offerId: number;
  isNew: boolean;
  priceChanged: boolean;
}

/** The little we need about a listing already in the database, to decide insert vs update. */
interface ExistingOffer {
  id: number;
  pricePln: number | null;
  rentPln: number | null;
}

function findExisting(
  db: DatabaseSync,
  source: string,
  sourceId: string,
): ExistingOffer | undefined {
  const row = db
    .prepare('select id, price_pln, rent_pln from offers where source = ? and source_id = ?')
    .get(source, sourceId);

  if (row === undefined) return undefined;

  return {
    id: readNumber(row, 'id'),
    pricePln: readNullableNumber(row, 'price_pln'),
    rentPln: readNullableNumber(row, 'rent_pln'),
  };
}

/** SQLite has no boolean type; it stores 0 and 1. */
function toDbBoolean(value: boolean | null): number | null {
  if (value === null) return null;
  return value ? 1 : 0;
}

const INSERT_SQL = `
  insert into offers (
    source, source_id, url, title, description,
    price_pln, rent_pln, deposit_pln,
    area_m2, rooms, floor,
    city, district, subdistrict, street, lat, lng, coords_precision,
    is_private_owner, status,
    created_at_source, pushed_up_at, first_seen_at, last_seen_at, raw
  ) values (
    ?, ?, ?, ?, ?,
    ?, ?, ?,
    ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?,
    ?, ?,
    ?, ?, ?, ?, ?
  )
`;

/**
 * Only the fields an advertiser can edit while the listing is live get updated.
 * first_seen_at is left alone, because it is our date, not the portal's.
 */
const UPDATE_SQL = `
  update offers set
    url = ?, title = ?, description = ?,
    price_pln = ?, rent_pln = ?, deposit_pln = ?,
    area_m2 = ?, rooms = ?, floor = ?,
    district = ?, subdistrict = ?, street = ?, lat = ?, lng = ?, coords_precision = ?,
    is_private_owner = ?, status = ?,
    pushed_up_at = ?, last_seen_at = ?, raw = ?
  where id = ?
`;

export function upsertOffer(
  db: DatabaseSync,
  offer: NormalizedOffer,
  now: string = new Date().toISOString(),
): UpsertResult {
  const existing = findExisting(db, offer.source, offer.sourceId);
  const raw = JSON.stringify(offer.raw);

  if (existing === undefined) {
    const result = db
      .prepare(INSERT_SQL)
      .run(
        offer.source,
        offer.sourceId,
        offer.url,
        offer.title,
        offer.description,
        offer.pricePln,
        offer.rentPln,
        offer.depositPln,
        offer.areaM2,
        offer.rooms,
        offer.floor,
        offer.city,
        offer.district,
        offer.subdistrict,
        offer.street,
        offer.lat,
        offer.lng,
        offer.coordsPrecision,
        toDbBoolean(offer.isPrivateOwner),
        offer.status,
        offer.createdAtSource,
        offer.pushedUpAt,
        now,
        now,
        raw,
      );

    const offerId = Number(result.lastInsertRowid);
    insertPriceHistory(db, offerId, offer, now);
    return { offerId, isNew: true, priceChanged: false };
  }

  db.prepare(UPDATE_SQL).run(
    offer.url,
    offer.title,
    offer.description,
    offer.pricePln,
    offer.rentPln,
    offer.depositPln,
    offer.areaM2,
    offer.rooms,
    offer.floor,
    offer.district,
    offer.subdistrict,
    offer.street,
    offer.lat,
    offer.lng,
    offer.coordsPrecision,
    toDbBoolean(offer.isPrivateOwner),
    offer.status,
    offer.pushedUpAt,
    now,
    raw,
    existing.id,
  );

  const priceChanged = existing.pricePln !== offer.pricePln || existing.rentPln !== offer.rentPln;

  if (priceChanged) {
    insertPriceHistory(db, existing.id, offer, now);
  }

  return { offerId: existing.id, isNew: false, priceChanged };
}

function insertPriceHistory(
  db: DatabaseSync,
  offerId: number,
  offer: NormalizedOffer,
  seenAt: string,
): void {
  db.prepare(
    'insert into price_history (offer_id, price_pln, rent_pln, seen_at) values (?, ?, ?, ?)',
  ).run(offerId, offer.pricePln, offer.rentPln, seenAt);
}
