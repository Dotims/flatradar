/**
 * The bounds a listing has to clear before it is worth a message.
 *
 * These are the dashboard's filters, kept a second time. The dashboard's own live in the
 * browser's local storage, where nothing outside that browser can read them, and the site
 * is public, so a copy the page could write to would be a copy anybody could write to.
 * This one is set in `.env` on the machine that sends the notifications.
 *
 * The price of that is real and worth stating: changing the filters on the site does not
 * change what the phone announces. The two are kept in step by hand.
 */
export interface NotifyFilters {
  minCostPln: number | null;
  maxCostPln: number | null;
  minAreaM2: number | null;
  maxAreaM2: number | null;
  minRooms: number | null;
  maxRooms: number | null;
  /** District names to stay quiet about. Everything else is announced. */
  hiddenDistricts: string[];
  privateOnly: boolean;
}

/** What the dashboard calls a listing the portal placed in no district at all. */
export const NO_DISTRICT = '(brak dzielnicy)';

export const NO_FILTERS: NotifyFilters = {
  minCostPln: null,
  maxCostPln: null,
  minAreaM2: null,
  maxAreaM2: null,
  minRooms: null,
  maxRooms: null,
  hiddenDistricts: [],
  privateOnly: false,
};

/**
 * Unlike the dashboard, a value that cannot be read is an error rather than an absent
 * bound. Local storage is edited by browsers and outlives deploys, so there the safe
 * answer is to drop a bound; `.env` is typed by the owner, where a silently ignored
 * `NOTIFY_MIN_AREA_M2=4O` means a filter believed to be on that never was.
 */
function bound(raw: string | undefined, name: string): number | null {
  if (raw === undefined || raw.trim() === '') return null;

  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} is not a number: "${raw}".`);
  if (value < 0) throw new Error(`${name} cannot be negative: "${raw}".`);
  return value;
}

/** Comma separated, because that is what fits on one line of an env file. */
function districts(raw: string | undefined): string[] {
  if (raw === undefined) return [];

  return raw
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
}

export function readNotifyFilters(env: Record<string, string | undefined>): NotifyFilters {
  const filters: NotifyFilters = {
    minCostPln: bound(env['NOTIFY_MIN_COST_PLN'], 'NOTIFY_MIN_COST_PLN'),
    maxCostPln: bound(env['NOTIFY_MAX_COST_PLN'], 'NOTIFY_MAX_COST_PLN'),
    minAreaM2: bound(env['NOTIFY_MIN_AREA_M2'], 'NOTIFY_MIN_AREA_M2'),
    maxAreaM2: bound(env['NOTIFY_MAX_AREA_M2'], 'NOTIFY_MAX_AREA_M2'),
    minRooms: bound(env['NOTIFY_MIN_ROOMS'], 'NOTIFY_MIN_ROOMS'),
    maxRooms: bound(env['NOTIFY_MAX_ROOMS'], 'NOTIFY_MAX_ROOMS'),
    hiddenDistricts: districts(env['NOTIFY_HIDDEN_DISTRICTS']),
    // Anything but a plain yes is a no: a filter that quietly narrows the search should
    // take more than a stray character in an env file to switch on.
    privateOnly: env['NOTIFY_PRIVATE_ONLY']?.trim().toLowerCase() === 'true',
  };

  // Caught here rather than as an empty result an hour later, when the round says nothing
  // was worth announcing and there is no way to tell that from nothing having turned up.
  for (const [min, max, name] of [
    [filters.minCostPln, filters.maxCostPln, 'COST_PLN'],
    [filters.minAreaM2, filters.maxAreaM2, 'AREA_M2'],
    [filters.minRooms, filters.maxRooms, 'ROOMS'],
  ] as const) {
    if (min !== null && max !== null && min > max) {
      throw new Error(`NOTIFY_MIN_${name} is above NOTIFY_MAX_${name}; nothing can match.`);
    }
  }

  return filters;
}
