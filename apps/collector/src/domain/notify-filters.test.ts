import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { NO_FILTERS, readNotifyFilters } from './notify-filters.ts';

describe('the bounds a notification has to clear', () => {
  test('an empty environment announces everything in budget', () => {
    assert.deepEqual(readNotifyFilters({}), NO_FILTERS);
  });

  test('reads the bounds the owner set', () => {
    const filters = readNotifyFilters({
      NOTIFY_MAX_COST_PLN: '2400',
      NOTIFY_MIN_AREA_M2: '30',
      NOTIFY_MIN_ROOMS: '2',
      NOTIFY_PRIVATE_ONLY: 'true',
      NOTIFY_HIDDEN_DISTRICTS: 'Bieńczyce, Czyżyny ,Stare Miasto',
    });

    assert.equal(filters.maxCostPln, 2400);
    assert.equal(filters.minAreaM2, 30);
    assert.equal(filters.minRooms, 2);
    assert.equal(filters.privateOnly, true);
    assert.deepEqual(filters.hiddenDistricts, ['Bieńczyce', 'Czyżyny', 'Stare Miasto']);
  });

  test('a blank value is no bound at all, not a zero', () => {
    assert.equal(readNotifyFilters({ NOTIFY_MIN_AREA_M2: '' }).minAreaM2, null);
    assert.equal(readNotifyFilters({ NOTIFY_HIDDEN_DISTRICTS: '' }).hiddenDistricts.length, 0);
  });

  /**
   * The failure this file exists for. A filter that looks set and is not means the owner
   * believes they are being told about fewer flats while being told about all of them, or
   * the reverse, and nothing in a working round would ever say so.
   */
  test('a value that is not a number stops the round rather than being ignored', () => {
    assert.throws(
      () => readNotifyFilters({ NOTIFY_MIN_AREA_M2: '4O' }),
      /NOTIFY_MIN_AREA_M2 is not a number/,
    );
  });

  test('bounds that cross each other are caught, not left to match nothing', () => {
    assert.throws(
      () => readNotifyFilters({ NOTIFY_MIN_ROOMS: '3', NOTIFY_MAX_ROOMS: '2' }),
      /nothing can match/,
    );
  });

  test('only a plain true switches a narrowing filter on', () => {
    assert.equal(readNotifyFilters({ NOTIFY_PRIVATE_ONLY: 'TRUE' }).privateOnly, true);
    assert.equal(readNotifyFilters({ NOTIFY_PRIVATE_ONLY: 'tak' }).privateOnly, false);
    assert.equal(readNotifyFilters({ NOTIFY_PRIVATE_ONLY: '1' }).privateOnly, false);
  });
});
