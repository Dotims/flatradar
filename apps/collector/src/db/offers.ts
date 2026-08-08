import type { DatabaseSync } from 'node:sqlite';
import type { CoordsPrecision, NormalizedOffer, OfferSource } from '../domain/offer.ts';
import {
  readNullableBoolean,
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

/** Only what an advertiser can edit. first_seen_at is ours, not the portal's. */
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

/** A listing read back out, carrying its row id. */
export interface StoredOffer extends NormalizedOffer {
  id: number;
}

// The check constraints live in SQLite, the types live here. Verify rather than assume.
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
    status: toStatus(readString(row, 'status')),
    createdAtSource: readNullableString(row, 'created_at_source'),
    pushedUpAt: readNullableString(row, 'pushed_up_at'),
    // Not selected: classification reads none of it.
    raw: null,
  };
}

/** Listings with no verdict or an outdated one. Bumping RULES_VERSION reclassifies all. */
export function listOffersToClassify(db: DatabaseSync, rulesVersion: number): StoredOffer[] {
  return db
    .prepare(
      `select o.id, o.source, o.source_id, o.url, o.title, o.description,
              o.price_pln, o.rent_pln, o.deposit_pln, o.area_m2, o.rooms, o.floor,
              o.city, o.district, o.subdistrict, o.street, o.lat, o.lng, o.coords_precision,
              o.is_private_owner, o.status, o.created_at_source, o.pushed_up_at
       from offers o
       left join classifications c on c.offer_id = o.id
       where c.offer_id is null or c.rules_version <> ?
       order by o.id`,
    )
    .all(rulesVersion)
    .map(toStoredOffer);
}
