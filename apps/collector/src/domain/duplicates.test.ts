import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blockKey, isSameListing, preferred, similarity, type Candidate } from './duplicates.ts';
import type { NormalizedOffer } from './offer.ts';

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    title: 'Kawalerka na Podgórzu, 28m2, blisko centrum',
    description: null,
    advertiser: null,
    pricePln: 2000,
    areaM2: 28,
    rooms: 1,
    ...overrides,
  };
}

test('the same advert on both portals is one listing', () => {
  // Taken from live data: identical titles, one on each portal.
  const title = '2 pokoje 1 osobowe dla dziewczyn Prokocim ul.Ścieg';
  assert.equal(isSameListing(candidate({ title }), candidate({ title })), true);
});

test('two different flats at the same rent and size are not', () => {
  const a = candidate({ title: 'Kawalerka obok Galerii Krakowskiej, Lubicz' });
  const b = candidate({ title: 'Przytulne studio z osobną kuchnią, ul. Nila' });
  assert.equal(isSameListing(a, b), false);
});

test('a shortened title is rescued by the description', () => {
  // Otodom trims titles, so the text that survives is the description.
  const long = candidate({
    title: '2 pokoje | winda | ze zwierzętami | Nowa Huta - Bieńczyce | od zaraz!',
    description: 'Do wynajęcia mieszkanie dwupokojowe z windą, zwierzęta akceptowane.',
  });
  const short = candidate({
    title: '2 pokoje | winda | ze zwierzętami | Nowa Huta',
    description: 'Do wynajęcia mieszkanie dwupokojowe z windą, zwierzęta akceptowane.',
  });
  assert.equal(isSameListing(long, short), true);
});

test('a shared advertiser lowers the bar but does not replace it', () => {
  const a = candidate({
    title: 'ul. Dietla / Brzozowa - od zaraz',
    advertiser: 'Prosper Nieruchomości',
  });
  const b = candidate({
    title: 'ul. Dietla - 2-pokojowe - od zaraz',
    advertiser: 'Prosper Nieruchomości',
  });
  assert.equal(isSameListing(a, b), true);

  // The same agency, two genuinely different flats: nothing in the text agrees.
  const c = candidate({ title: 'Nowoczesny apartament Zabłocie z tarasem', advertiser: 'homfi' });
  const d = candidate({ title: 'Kawalerka Ruczaj przy pętli tramwajowej', advertiser: 'homfi' });
  assert.equal(isSameListing(c, d), false);
});

test('a company suffix does not decide whether two names match', () => {
  const a = candidate({
    title: 'Łagiewniki | mieszkanie 1 pokojowe',
    advertiser: 'All in One S A',
  });
  const b = candidate({ title: 'Łagiewniki | 1 pok. mieszkanie', advertiser: 'ALL IN ONE S.A.' });
  assert.equal(isSameListing(a, b), true);
});

test('similarity is symmetric and bounded', () => {
  assert.equal(similarity('kawalerka', 'kawalerka'), 1);
  assert.equal(similarity('kawalerka', ''), 0);
  assert.equal(similarity('abc def', 'def abc'), similarity('def abc', 'abc def'));
});

test('a listing missing rent or area has no block key', () => {
  assert.equal(blockKey({ pricePln: null, areaM2: 30, rooms: 1 }), '');
  assert.equal(blockKey({ pricePln: 2000, areaM2: null, rooms: 1 }), '');
  assert.equal(blockKey({ pricePln: 2000, areaM2: 29.6, rooms: 1 }), '2000|30|1');
});

function stored(overrides: Partial<NormalizedOffer> = {}) {
  return {
    coordsPrecision: null,
    description: null,
    isPrivateOwner: null,
    ...overrides,
  } as Pick<NormalizedOffer, 'coordsPrecision' | 'description' | 'isPrivateOwner'>;
}

test('the listing kept is the one that can be put on the map', () => {
  const exact = stored({ coordsPrecision: 'exact' });
  const approximate = stored({
    coordsPrecision: 'approximate',
    description: 'x',
    isPrivateOwner: true,
  });
  assert.equal(preferred(approximate, exact), exact);
});

test('with equal pins, a description and a private seller decide', () => {
  const bare = stored({ coordsPrecision: 'approximate' });
  const full = stored({ coordsPrecision: 'approximate', description: 'x', isPrivateOwner: true });
  assert.equal(preferred(bare, full), full);
  assert.equal(preferred(full, bare), full);
});
