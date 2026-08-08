import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseOlxOffer } from './parse.ts';
import type { OlxOffer, OlxOffersResponse } from './types.ts';

/**
 * The fixture is a real OLX response with seller details stripped, not a hand-written
 * object. The point is to stay honest about what the portal actually returns.
 */
const fixture = JSON.parse(
  readFileSync(new URL('./__fixtures__/offers-krakow.json', import.meta.url), 'utf8'),
) as OlxOffersResponse;

function offerAt(index: number): OlxOffer {
  const offer = fixture.data[index];
  if (offer === undefined) throw new Error(`Fixture has no offer at index ${index}`);
  return offer;
}

test('reads price, building fee and floor area as numbers', () => {
  const parsed = parseOlxOffer(offerAt(0));

  strictEqual(parsed.source, 'olx');
  strictEqual(parsed.pricePln, 2700);
  strictEqual(typeof parsed.rentPln, 'number');
  strictEqual(typeof parsed.areaM2, 'number');
  strictEqual(parsed.city, 'Kraków');
  strictEqual(parsed.district, 'Grzegórzki');
});

test('tells a private listing from a business one', () => {
  strictEqual(parseOlxOffer(offerAt(0)).isPrivateOwner, true);
  strictEqual(parseOlxOffer(offerAt(1)).isPrivateOwner, false);
});

test('converts portal timestamps to ISO in UTC', () => {
  const parsed = parseOlxOffer(offerAt(0));
  strictEqual(parsed.createdAtSource, new Date(offerAt(0).created_time).toISOString());
  strictEqual(parsed.createdAtSource?.endsWith('Z'), true);
});

test('marks OLX coordinates as approximate', () => {
  const parsed = parseOlxOffer(offerAt(0));
  strictEqual(parsed.coordsPrecision, 'approximate');
  strictEqual(typeof parsed.lat, 'number');
});

test('a missing district yields null rather than throwing', () => {
  const offer = structuredClone(offerAt(0));
  delete offer.location.district;

  strictEqual(parseOlxOffer(offer).district, null);
});

test('an empty building fee field yields null rather than NaN', () => {
  const offer = structuredClone(offerAt(0));
  const rent = offer.params.find((param) => param.key === 'rent');
  if (rent) rent.value = { key: '', label: '' };

  strictEqual(parseOlxOffer(offer).rentPln, null);
});

test('an unknown room count code does not break parsing', () => {
  const offer = structuredClone(offerAt(0));
  const rooms = offer.params.find((param) => param.key === 'rooms');
  if (rooms) rooms.value = { key: 'siedem', label: '7' };

  strictEqual(parseOlxOffer(offer).rooms, null);
});

test('keeps the portal response untouched', () => {
  const offer = offerAt(0);
  deepStrictEqual(parseOlxOffer(offer).raw, offer);
});
