import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseOtodomOffer } from './parse.ts';
import type { OtodomAdResponse, OtodomListItem, OtodomSearchResponse } from './types.ts';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8'));

const search = fixture('search-krakow.json') as OtodomSearchResponse;
const items = search.pageProps.data?.searchAds?.items ?? [];
const detail = (fixture('ad.json') as OtodomAdResponse).pageProps.ad;

function itemAt(index: number): OtodomListItem {
  const item = items[index];
  if (item === undefined) throw new Error(`The fixture has no item ${index}.`);
  return item;
}

test('reads the advertised rent and the building fee as separate numbers', () => {
  const offer = parseOtodomOffer(itemAt(0));
  // Otodom labels the rent "totalPrice" although the fee is quoted apart from it.
  assert.equal(offer.pricePln, 3099);
  assert.equal(offer.rentPln, 450);
});

test('reads the district out of the reverse geocoding path', () => {
  // The structured address usually leaves the district out, so it is recovered from the
  // location path, where the fifth level is the district.
  assert.equal(parseOtodomOffer(itemAt(0)).district, 'Prądnik Czerwony');
});

test('turns the room name into a number', () => {
  assert.equal(parseOtodomOffer(itemAt(0)).rooms, 2);
});

test('tells a private listing from an agency one', () => {
  assert.equal(parseOtodomOffer(itemAt(0)).isPrivateOwner, false);
  assert.equal(parseOtodomOffer(itemAt(1)).isPrivateOwner, true);
});

test('builds the listing url from the slug', () => {
  const offer = parseOtodomOffer(itemAt(0));
  assert.ok(offer.url.startsWith('https://www.otodom.pl/pl/oferta/'));
  assert.ok(offer.url.endsWith(itemAt(0).slug));
});

test('without the listing page there is no description and no pin', () => {
  const offer = parseOtodomOffer(itemAt(0));
  assert.equal(offer.description, null);
  assert.equal(offer.lat, null);
  assert.equal(offer.coordsPrecision, null);
});

test('the listing page adds the description and an exact pin', () => {
  const offer = parseOtodomOffer(itemAt(0), detail);
  assert.equal(offer.lat, 50.093163);
  assert.equal(offer.lng, 19.986994);
  // radius 0 is a real address rather than the blurred circle OLX reports.
  assert.equal(offer.coordsPrecision, 'exact');
  assert.ok((offer.description ?? '').length > 0);
});

test('prefers the first publication date over the edit date', () => {
  // dateCreated moves whenever the advertiser edits, which would make an old flat new.
  const offer = parseOtodomOffer(itemAt(0));
  assert.equal(offer.createdAtSource, new Date(itemAt(0).createdAtFirst ?? '').toISOString());
});

test('an unknown room name does not break parsing', () => {
  const item = structuredClone(itemAt(0));
  item.roomsNumber = 'ELEVENTY';
  assert.equal(parseOtodomOffer(item).rooms, null);
});

test('a listing with no location details still parses', () => {
  const item = structuredClone(itemAt(0));
  item.location = {};
  const offer = parseOtodomOffer(item);
  assert.equal(offer.district, null);
  assert.equal(offer.street, null);
  assert.equal(offer.city, 'Kraków');
});

test('missing prices become null rather than zero', () => {
  const item = structuredClone(itemAt(0));
  item.totalPrice = null;
  item.rentPrice = null;
  const offer = parseOtodomOffer(item);
  assert.equal(offer.pricePln, null);
  assert.equal(offer.rentPln, null);
});

test('keeps both payloads when the listing page was read', () => {
  const offer = parseOtodomOffer(itemAt(0), detail);
  assert.deepEqual(offer.raw, { item: itemAt(0), ad: detail });
});

test('an ad page with no images yields an empty gallery', () => {
  // The recorded ad carries no images array, which is also what a listing whose page was
  // never fetched looks like: both have to come out as no photographs rather than throw.
  assert.deepEqual(parseOtodomOffer(itemAt(0), detail).photos, []);
  assert.deepEqual(parseOtodomOffer(itemAt(0)).photos, []);
});
