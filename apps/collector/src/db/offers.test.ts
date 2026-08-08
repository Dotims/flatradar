import { strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import type { NormalizedOffer } from '../domain/offer.ts';
import { migrate } from './migrate.ts';
import { openDatabase } from './open.ts';
import { upsertOffer } from './offers.ts';

function freshDatabase(): DatabaseSync {
  const db = openDatabase(':memory:');
  migrate(db);
  return db;
}

function sampleOffer(overrides: Partial<NormalizedOffer> = {}): NormalizedOffer {
  return {
    source: 'olx',
    sourceId: '123',
    url: 'https://www.olx.pl/d/oferta/test',
    title: 'Test studio',
    description: 'description',
    pricePln: 2000,
    rentPln: 400,
    depositPln: null,
    areaM2: 30,
    rooms: 1,
    floor: '2',
    city: 'Kraków',
    district: 'Podgórze',
    subdistrict: null,
    street: null,
    lat: 50.05,
    lng: 19.94,
    coordsPrecision: 'approximate',
    isPrivateOwner: true,
    status: 'active',
    createdAtSource: '2026-08-08T00:00:00.000Z',
    pushedUpAt: null,
    raw: { id: 123 },
    ...overrides,
  };
}

function countRows(db: DatabaseSync, table: string): number {
  const row = db.prepare(`select count(*) as total from ${table}`).get();
  return Number(row?.total ?? 0);
}

test('the same listing seen twice does not create a duplicate', () => {
  const db = freshDatabase();

  const first = upsertOffer(db, sampleOffer());
  const second = upsertOffer(db, sampleOffer());

  strictEqual(first.isNew, true);
  strictEqual(second.isNew, false);
  strictEqual(second.offerId, first.offerId);
  strictEqual(countRows(db, 'offers'), 1);

  db.close();
});

test('the first sighting records a price history entry', () => {
  const db = freshDatabase();

  upsertOffer(db, sampleOffer());

  strictEqual(countRows(db, 'price_history'), 1);

  db.close();
});

test('a changed building fee appends to the price history, an unchanged one does not', () => {
  const db = freshDatabase();

  upsertOffer(db, sampleOffer());
  const unchanged = upsertOffer(db, sampleOffer());
  strictEqual(unchanged.priceChanged, false);
  strictEqual(countRows(db, 'price_history'), 1);

  const changed = upsertOffer(db, sampleOffer({ rentPln: 550 }));
  strictEqual(changed.priceChanged, true);
  strictEqual(countRows(db, 'price_history'), 2);

  db.close();
});

test('an update leaves the first-seen date alone', () => {
  const db = freshDatabase();

  upsertOffer(db, sampleOffer(), '2026-08-01T10:00:00.000Z');
  upsertOffer(db, sampleOffer({ title: 'Changed title' }), '2026-08-05T10:00:00.000Z');

  const row = db.prepare('select first_seen_at, last_seen_at, title from offers').get();

  strictEqual(row?.first_seen_at, '2026-08-01T10:00:00.000Z');
  strictEqual(row?.last_seen_at, '2026-08-05T10:00:00.000Z');
  strictEqual(row?.title, 'Changed title');

  db.close();
});

test('the same id on two portals means two separate listings', () => {
  const db = freshDatabase();

  upsertOffer(db, sampleOffer({ source: 'olx', sourceId: '999' }));
  upsertOffer(db, sampleOffer({ source: 'otodom', sourceId: '999' }));

  strictEqual(countRows(db, 'offers'), 2);

  db.close();
});
