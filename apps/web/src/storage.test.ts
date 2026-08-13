import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MARKS_KEY, readKey, type KeyValueStore } from './storage.ts';

const LEGACY_MARKS = 'flatradar:marks';

/** A real Storage in miniature: keyed, and able to forget. */
function store(initial: Record<string, string> = {}): KeyValueStore & {
  seen: Record<string, string>;
} {
  const seen = { ...initial };
  return {
    seen,
    getItem: (key) => seen[key] ?? null,
    setItem: (key, value) => {
      seen[key] = value;
    },
    removeItem: (key) => {
      delete seen[key];
    },
  };
}

test('a value already under the current name is read as it is', () => {
  const storage = store({ [MARKS_KEY]: '{"1":"favourite"}' });
  assert.equal(readKey(storage, MARKS_KEY), '{"1":"favourite"}');
});

test('a value left under the old name is read and carried across', () => {
  const storage = store({ [LEGACY_MARKS]: '{"7":"rejected"}' });

  assert.equal(readKey(storage, MARKS_KEY), '{"7":"rejected"}');
  // Moved rather than copied, or this stays a fallback for as long as the browser lives.
  assert.equal(storage.seen[MARKS_KEY], '{"7":"rejected"}');
  assert.equal(storage.seen[LEGACY_MARKS], undefined);
});

/** The old key is what a browser last wrote before the rename, so it is always staler. */
test('the current name wins over a leftover under the old one', () => {
  const storage = store({ [MARKS_KEY]: '{"2":"favourite"}', [LEGACY_MARKS]: '{"9":"rejected"}' });
  assert.equal(readKey(storage, MARKS_KEY), '{"2":"favourite"}');
});

test('neither name set reads as nothing stored', () => {
  assert.equal(readKey(store(), MARKS_KEY), null);
});

/** The doubles in marks.test.ts are two methods wide; a missing removeItem must not throw. */
test('a store that cannot forget still migrates the value', () => {
  const seen: Record<string, string> = { [LEGACY_MARKS]: '{"3":"favourite"}' };
  const storage: KeyValueStore = {
    getItem: (key) => seen[key] ?? null,
    setItem: (key, value) => {
      seen[key] = value;
    },
  };

  assert.equal(readKey(storage, MARKS_KEY), '{"3":"favourite"}');
  assert.equal(seen[MARKS_KEY], '{"3":"favourite"}');
});
