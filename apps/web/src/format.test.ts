import assert from 'node:assert/strict';
import { test } from 'node:test';
import { minutesSince, since } from './format.ts';

/** Polish inflects by count in three classes; the hand-rolled version said "1 dni temu". */
test('relative times take the right Polish form', () => {
  const ago = (minutes: number) => since(new Date(Date.now() - minutes * 60_000).toISOString());

  assert.equal(ago(0), 'przed chwilą');
  assert.equal(ago(1), '1 minutę temu');
  assert.equal(ago(22), '22 minuty temu');
  assert.equal(ago(60), '1 godzinę temu');
  assert.equal(ago(180), '3 godziny temu');
  assert.equal(ago(60 * 24), '1 dzień temu');
  assert.equal(ago(60 * 24 * 5), '5 dni temu');
});

test('a missing timestamp is a dash, not an invalid date', () => {
  assert.equal(since(null), '—');
  assert.equal(minutesSince(null), null);
  assert.equal(minutesSince('not a date'), null);
});

test('minutesSince counts elapsed minutes', () => {
  assert.equal(minutesSince(new Date(Date.now() - 90 * 60_000).toISOString()), 90);
});
