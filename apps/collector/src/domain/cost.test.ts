import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readUtilityCost, toPlainText } from './cost.ts';

/**
 * Every string below is a real fragment of an OLX description, kept as written, typos
 * and all. They exist because the first version of this parser read half of them wrong:
 * it counted the building fee as utilities, took a garage space for electricity and
 * found 1000 PLN of media in a description of the kitchen.
 */

test('reads an amount the description states plainly', () => {
  const reading = readUtilityCost('media w wysokości 650zł (ogrzewanie, prąd)');
  assert.equal(reading.certainty, 'exact');
  assert.equal(reading.amountPln, 650);
});

test('reads an amount separated from the word by a few words', () => {
  const reading = readUtilityCost('prąd według zużycia około 120zł');
  assert.equal(reading.amountPln, 120);
});

test('reads an amount that comes before the word', () => {
  const reading = readUtilityCost('najmu 2700 zł + ok. 850 zł opłat dodatkowych');
  assert.equal(reading.amountPln, 850);
});

test('skips the building fee and takes the utilities that follow', () => {
  const reading = readUtilityCost(
    'opłaty administracyjne przy 2 osobach: 680 zł, zaliczka na prąd 70 zł',
  );
  assert.equal(reading.amountPln, 70);
});

test('does not read the building fee as utilities', () => {
  // The portal reports this number separately, so counting it here would double it.
  const reading = readUtilityCost('czynsz administracyjny 1064 pln + prąd');
  assert.equal(reading.amountPln, null);
  assert.equal(reading.certainty, 'uncertain');
});

test('does not read a parking space as utilities', () => {
  const reading = readUtilityCost(
    'miejsce parkingowe w garażu podziemnym za dodatkową opłata 400zł',
  );
  assert.equal(reading.amountPln, null);
});

test('does not read kitchen equipment as utilities', () => {
  const reading = readUtilityCost('kuchnia wyposażona w kuchenkę gazową, meble za 1000 zł');
  assert.equal(reading.amountPln, null);
});

test('treats metered utilities without a figure as uncertain', () => {
  const reading = readUtilityCost('prąd według zużycia');
  assert.equal(reading.certainty, 'uncertain');
  assert.equal(reading.amountPln, null);
  assert.equal(reading.mentioned, true);
});

test('recognises a description that says everything is included', () => {
  assert.equal(readUtilityCost('łaczna kwota 2790 zł już ze wszystkim').certainty, 'all_in');
  assert.equal(readUtilityCost('media wliczone w cenę').certainty, 'all_in');
});

test('silence about utilities is uncertainty, not zero', () => {
  const reading = readUtilityCost('Przytulna kawalerka blisko centrum.');
  assert.equal(reading.certainty, 'uncertain');
  assert.equal(reading.mentioned, false);
});

test('a missing description is uncertain rather than an error', () => {
  assert.equal(readUtilityCost(null).certainty, 'uncertain');
});

test('rejects figures too small or too large to be utilities', () => {
  assert.equal(readUtilityCost('prąd 20 zł').amountPln, null);
  assert.equal(readUtilityCost('media 3000 zł').amountPln, null);
});

test('strips the HTML the portal wraps descriptions in', () => {
  const text = toPlainText('<strong>Opłaty</strong>&nbsp;<br />media 500 zł');
  assert.equal(text.includes('<'), false);
  assert.equal(text.includes('&nbsp;'), false);
  assert.equal(readUtilityCost('<strong>media</strong>&nbsp;500 zł').amountPln, 500);
});
