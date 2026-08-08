import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyFilters, availableDistricts, DEFAULT_FILTERS, NO_DISTRICT } from './filters.ts';
import type { Offer } from './types.ts';

function offer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 1,
    source: 'olx',
    url: 'https://www.olx.pl/d/oferta/1',
    title: 'Mieszkanie',
    district: 'Dębniki',
    areaM2: 40,
    rooms: 2,
    floor: null,
    pricePln: 2000,
    rentPln: 300,
    totalCostPln: 2300,
    tier: 'top',
    costCertainty: 'exact',
    reasons: [],
    isPrivateOwner: true,
    lat: null,
    lng: null,
    coordsPrecision: null,
    createdAtSource: null,
    firstSeenAt: '2026-08-08T00:00:00.000Z',
    ...overrides,
  };
}

test('keeps a listing that satisfies every filter', () => {
  assert.equal(applyFilters([offer()], DEFAULT_FILTERS).length, 1);
});

test('drops a listing above the cost limit', () => {
  const offers = [offer({ totalCostPln: 2700 })];
  assert.equal(applyFilters(offers, { ...DEFAULT_FILTERS, maxCostPln: 2600 }).length, 0);
});

test('the cost limit does not apply to the cheap-rent tier', () => {
  // That tier is defined as a total above the all-in limit, so capping it by total hid
  // the entire tier whenever the cap sat at the budget.
  const offers = [offer({ tier: 'worth', totalCostPln: 3050 })];
  assert.equal(applyFilters(offers, { ...DEFAULT_FILTERS, maxCostPln: 2600 }).length, 1);
});

test('the shipped defaults can return every tier they ask for', () => {
  const offers = [
    offer({ id: 1, tier: 'top', totalCostPln: 2400 }),
    offer({ id: 2, tier: 'worth', totalCostPln: 2900 }),
  ];
  const kept = applyFilters(offers, DEFAULT_FILTERS).map((item) => item.tier);
  assert.deepEqual(kept, ['top', 'worth']);
});

test('drops a listing below the area limit', () => {
  const offers = [offer({ areaM2: 25 })];
  assert.equal(applyFilters(offers, { ...DEFAULT_FILTERS, minAreaM2: 35 }).length, 0);
});

test('keeps a listing whose area the portal never stated', () => {
  // Dropping these would quietly shrink the search over a field advertisers skip.
  const offers = [offer({ areaM2: null })];
  assert.equal(applyFilters(offers, { ...DEFAULT_FILTERS, minAreaM2: 35 }).length, 1);
});

test('keeps a listing whose total could not be computed', () => {
  const offers = [offer({ totalCostPln: null })];
  assert.equal(applyFilters(offers, { ...DEFAULT_FILTERS, maxCostPln: 1000 }).length, 1);
});

test('an empty tier list means every tier', () => {
  const offers = [offer({ tier: 'other' })];
  assert.equal(applyFilters(offers, { ...DEFAULT_FILTERS, tiers: [] }).length, 1);
});

test('the tier filter keeps only the tiers asked for', () => {
  const offers = [offer({ tier: 'top' }), offer({ id: 2, tier: 'other' })];
  assert.equal(applyFilters(offers, { ...DEFAULT_FILTERS, tiers: ['top'] }).length, 1);
});

test('an empty district list means every district', () => {
  const offers = [offer({ district: 'Podgórze' })];
  assert.equal(applyFilters(offers, { ...DEFAULT_FILTERS, districts: [] }).length, 1);
});

test('a listing with no district is reachable through its own entry', () => {
  const offers = [offer({ district: null })];
  assert.equal(applyFilters(offers, { ...DEFAULT_FILTERS, districts: ['Dębniki'] }).length, 0);
  assert.equal(applyFilters(offers, { ...DEFAULT_FILTERS, districts: [NO_DISTRICT] }).length, 1);
});

test('the private filter drops agency listings but keeps unknown ones', () => {
  const offers = [
    offer({ isPrivateOwner: false }),
    offer({ id: 2, isPrivateOwner: null }),
    offer({ id: 3, isPrivateOwner: true }),
  ];
  const kept = applyFilters(offers, { ...DEFAULT_FILTERS, privateOnly: true });
  assert.deepEqual(
    kept.map((item) => item.id),
    [2, 3],
  );
});

test('district options are sorted and deduplicated', () => {
  const offers = [
    offer({ district: 'Podgórze' }),
    offer({ id: 2, district: 'Dębniki' }),
    offer({ id: 3, district: 'Dębniki' }),
    offer({ id: 4, district: null }),
  ];
  assert.deepEqual(availableDistricts(offers), [NO_DISTRICT, 'Dębniki', 'Podgórze']);
});
