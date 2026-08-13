/**
 * Where the dashboard keeps what belongs to one browser rather than to the database: the
 * theme, the chosen layout, and the marks put on listings.
 *
 * These keys carried the old product name, and every browser that has already visited
 * still holds them under it. Renaming them without moving the values would have thrown
 * away the marks, which are the one thing stored here that cannot simply be fetched
 * again. So a key is read under its new name first and under the old one after, and
 * anything found under the old name is carried across as it is read.
 */

const PREFIX = 'overheads:';
const LEGACY_PREFIX = 'flatradar:';

export const THEME_KEY = `${PREFIX}theme`;
export const MARKS_KEY = `${PREFIX}marks`;
export const VIEW_KEY = `${PREFIX}view`;

/** The slice of Storage these modules use, so a test can pass a plain object instead. */
export interface KeyValueStore {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

function legacyName(key: string): string {
  return key.replace(PREFIX, LEGACY_PREFIX);
}

/**
 * Reads a key, falling back to the name it had before the rename and moving the value
 * across when it turns up there. Null when neither name holds anything.
 */
export function readKey(store: KeyValueStore, key: string): string | null {
  const current = store.getItem(key);
  if (current !== null) return current;

  const legacy = store.getItem(legacyName(key));
  if (legacy === null) return null;

  store.setItem(key, legacy);
  // Optional because the test doubles are two methods wide. A real Storage always has it,
  // and clearing the old key is what stops this from being a fallback forever.
  store.removeItem?.(legacyName(key));
  return legacy;
}
