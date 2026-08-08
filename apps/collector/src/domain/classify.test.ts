import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classify } from './classify.ts';
import type { NormalizedOffer } from './offer.ts';

/** A listing that passes every rule, so each test can break exactly one thing. */
function offer(overrides: Partial<NormalizedOffer> = {}): NormalizedOffer {
  return {
    source: 'olx',
    sourceId: '1',
    url: 'https://www.olx.pl/d/oferta/1',
    title: 'Mieszkanie',
    description: 'media wliczone w cenę',
    pricePln: 2000,
    rentPln: 300,
    depositPln: null,
    areaM2: 35,
    rooms: 2,
    floor: null,
    city: 'Kraków',
    district: 'Nowa Huta',
    subdistrict: null,
    street: null,
    lat: null,
    lng: null,
    coordsPrecision: null,
    isPrivateOwner: true,
    status: 'active',
    createdAtSource: null,
    pushedUpAt: null,
    raw: {},
    ...overrides,
  };
}

test('a cheap flat in the right district is top', () => {
  const result = classify(offer());
  assert.equal(result.tier, 'top');
  assert.equal(result.totalCostPln, 2300);
});

test('an excluded district rules out a listing whatever it costs', () => {
  const result = classify(offer({ district: 'Krowodrza', pricePln: 900, rentPln: 0 }));
  assert.equal(result.tier, 'other');
  assert.ok(result.reasons.some((reason) => reason.includes('excluded district')));
});

test('a listing with no district set is kept', () => {
  // Advertisers leave the field blank often enough that dropping these would hide
  // real offers, so the absence of a district is not a reason to reject.
  assert.equal(classify(offer({ district: null })).tier, 'top');
});

test('district matching ignores casing and stray whitespace', () => {
  assert.equal(classify(offer({ district: '  krowodrza ' })).tier, 'other');
});

test('an unknown total never reaches the priority tier', () => {
  // Rent and fee alone would fit under the limit, but the utilities are anyone's guess.
  const result = classify(offer({ description: 'prąd według zużycia' }));
  assert.equal(result.costCertainty, 'uncertain');
  assert.equal(result.tier, 'worth');
});

test('stated utilities are added to the total', () => {
  const result = classify(offer({ description: 'media 400 zł miesięcznie' }));
  assert.equal(result.costCertainty, 'exact');
  assert.equal(result.totalCostPln, 2700);
  // 2700 is over the all-in limit, but the rent alone still qualifies.
  assert.equal(result.tier, 'worth');
});

test('rent above the lower limit with an unknown total is rejected', () => {
  const result = classify(offer({ pricePln: 2500, description: 'prąd według zużycia' }));
  assert.equal(result.tier, 'other');
});

test('rent above the lower limit still reaches top when the total is known and fits', () => {
  const result = classify(offer({ pricePln: 2400, rentPln: 150 }));
  assert.equal(result.tier, 'top');
  assert.equal(result.totalCostPln, 2550);
});

test('both limits are inclusive', () => {
  assert.equal(classify(offer({ pricePln: 2300, rentPln: 300 })).totalCostPln, 2600);
  assert.equal(classify(offer({ pricePln: 2300, rentPln: 300 })).tier, 'top');
  assert.equal(
    classify(offer({ pricePln: 2200, rentPln: null, description: 'prąd wg zużycia' })).tier,
    'worth',
  );
});

test('a missing building fee counts as zero rather than blocking the verdict', () => {
  const result = classify(offer({ rentPln: null }));
  assert.equal(result.totalCostPln, 2000);
});

test('a listing with no rent stated cannot be judged', () => {
  const result = classify(offer({ pricePln: null }));
  assert.equal(result.tier, 'other');
  assert.equal(result.totalCostPln, null);
});

test('every verdict explains itself', () => {
  for (const sample of [offer(), offer({ district: 'Czyżyny' }), offer({ pricePln: null })]) {
    assert.ok(classify(sample).reasons.length > 0);
  }
});
