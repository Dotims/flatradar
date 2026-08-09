import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { openDatabase, type Sql } from './client.ts';
import { migrate } from './migrate.ts';
import { upsertOffer } from './offers.ts';
import type { NormalizedOffer } from '../domain/offer.ts';

/**
 * Needs a throwaway Postgres. CI provides one; locally these are skipped unless
 * TEST_DATABASE_URL is set. Never point it at the database holding real listings:
 * every case starts by emptying the tables.
 */
const TEST_URL = process.env.TEST_DATABASE_URL;

function offer(overrides: Partial<NormalizedOffer> = {}): NormalizedOffer {
  return {
    source: 'olx',
    sourceId: '1',
    url: 'https://www.olx.pl/d/oferta/1',
    title: 'Mieszkanie',
    description: null,
    pricePln: 2000,
    rentPln: 300,
    depositPln: null,
    areaM2: 35,
    rooms: 2,
    floor: null,
    city: 'Kraków',
    district: 'Podgórze',
    subdistrict: null,
    street: null,
    lat: null,
    lng: null,
    coordsPrecision: null,
    isPrivateOwner: true,
    status: 'active',
    createdAtSource: '2026-08-01T10:00:00.000Z',
    pushedUpAt: null,
    raw: { id: 1 },
    ...overrides,
  };
}

describe(
  'upsertOffer',
  { skip: TEST_URL === undefined ? 'TEST_DATABASE_URL is not set' : false },
  () => {
    let sql: Sql;

    before(async () => {
      sql = openDatabase(TEST_URL ?? '');
      await migrate(sql);
    });

    beforeEach(async () => {
      await sql`truncate offers restart identity cascade`;
    });

    after(async () => {
      await sql.end();
    });

    test('seeing the same listing twice does not duplicate it', async () => {
      const first = await upsertOffer(sql, offer());
      const second = await upsertOffer(sql, offer());

      assert.equal(first.isNew, true);
      assert.equal(second.isNew, false);
      assert.equal(second.offerId, first.offerId);

      const [row] = await sql`select count(*) as total from offers`;
      assert.equal(Number(row?.total), 1);
    });

    test('the first sighting records a price history entry', async () => {
      await upsertOffer(sql, offer());
      const [row] = await sql`select count(*) as total from price_history`;
      assert.equal(Number(row?.total), 1);
    });

    test('a changed building fee appends to the price history, an unchanged one does not', async () => {
      await upsertOffer(sql, offer());
      const same = await upsertOffer(sql, offer());
      assert.equal(same.priceChanged, false);

      const changed = await upsertOffer(sql, offer({ rentPln: 450 }));
      assert.equal(changed.priceChanged, true);

      const [row] = await sql`select count(*) as total from price_history`;
      assert.equal(Number(row?.total), 2);
    });

    test('an update leaves the first-seen date alone', async () => {
      await upsertOffer(sql, offer(), { now: '2026-08-01T00:00:00.000Z' });
      await upsertOffer(sql, offer({ title: 'Nowy tytuł' }), { now: '2026-08-05T00:00:00.000Z' });

      const [row] = await sql`select first_seen_at, last_seen_at, title from offers`;
      assert.equal((row?.first_seen_at as Date).toISOString(), '2026-08-01T00:00:00.000Z');
      assert.equal((row?.last_seen_at as Date).toISOString(), '2026-08-05T00:00:00.000Z');
      assert.equal(row?.title, 'Nowy tytuł');
    });

    test('preserveDetail keeps the detail a later detail-less pass does not carry', async () => {
      // The backfill re-reads listings it already detailed and would otherwise write
      // its empty description, pin and payload straight over them.
      await upsertOffer(
        sql,
        offer({
          description: 'Pełny opis.',
          lat: 50.05,
          lng: 19.94,
          coordsPrecision: 'exact',
          raw: { ad: { images: ['a.jpg'] } },
        }),
      );

      await upsertOffer(sql, offer({ pricePln: 1900 }), { preserveDetail: true });

      const [row] = await sql`select description, lat, price_pln, raw from offers`;
      assert.equal(row?.description, 'Pełny opis.');
      assert.equal(Number(row?.lat), 50.05);
      assert.equal(Number(row?.price_pln), 1900);
      // jsonb arrives as text from this driver, so compare the parsed payload.
      assert.deepEqual(JSON.parse(String(row?.raw)), { ad: { images: ['a.jpg'] } });
    });

    test('the same id on two portals means two separate listings', async () => {
      await upsertOffer(sql, offer({ source: 'olx', sourceId: '123' }));
      await upsertOffer(sql, offer({ source: 'otodom', sourceId: '123' }));

      const [row] = await sql`select count(*) as total from offers`;
      assert.equal(Number(row?.total), 2);
    });
  },
);
