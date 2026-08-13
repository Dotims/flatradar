import { FILTERS_KEY, readKey, type KeyValueStore } from './storage.ts';
import type { Offer, SortKey } from './types.ts';

/** Every bound is optional: a blank box is a bound the owner did not ask for. */
export interface Filters {
  minCostPln: number | null;
  maxCostPln: number | null;
  minAreaM2: number | null;
  maxAreaM2: number | null;
  minRooms: number | null;
  maxRooms: number | null;
  /** Districts switched off. Anything new the portals report shows up by default. */
  hiddenDistricts: string[];
  privateOnly: boolean;
  /** Only the ones kept for later. */
  favouritesOnly: boolean;
  /** Ruled out by hand. Off by default: that is the point of ruling one out. */
  showRejected: boolean;
}

/**
 * The districts ruled out on 2026-08-08. They are a starting position rather than a
 * rule now: the collector stores and scores every district, and this list only decides
 * what the page opens with, so one click brings any of them back.
 */
export const DEFAULT_HIDDEN_DISTRICTS = [
  'Bieńczyce',
  'Bronowice',
  'Czyżyny',
  'Grzegórzki',
  'Krowodrza',
  'Mistrzejowice',
  'Prądnik Biały',
  'Prądnik Czerwony',
  'Stare Miasto',
  'Zwierzyniec',
];

export const DEFAULT_FILTERS: Filters = {
  minCostPln: null,
  maxCostPln: 2600,
  minAreaM2: null,
  maxAreaM2: null,
  minRooms: null,
  maxRooms: null,
  hiddenDistricts: DEFAULT_HIDDEN_DISTRICTS,
  privateOnly: false,
  favouritesOnly: false,
  showRejected: false,
};

export const NO_DISTRICT = '(brak dzielnicy)';

function outsideRange(value: number | null, min: number | null, max: number | null): boolean {
  // A listing missing the value a filter asks about is kept: half the portal fields
  // are optional and dropping them would quietly shrink the search.
  if (value === null) return false;
  if (min !== null && value < min) return true;
  return max !== null && value > max;
}

/** Free of React so it can be tested directly. */
export function applyFilters(offers: Offer[], filters: Filters): Offer[] {
  return offers.filter((offer) => {
    // Ruled out by hand and kept by hand both outrank the bounds: a favourite that no
    // longer fits the budget is still the flat the owner wanted to keep looking at.
    if (offer.mark === 'rejected') return filters.showRejected;
    if (filters.favouritesOnly) return offer.mark === 'favourite';
    if (offer.mark === 'favourite') return true;

    if (outsideRange(offer.totalCostPln, filters.minCostPln, filters.maxCostPln)) return false;
    if (outsideRange(offer.areaM2, filters.minAreaM2, filters.maxAreaM2)) return false;
    if (outsideRange(offer.rooms, filters.minRooms, filters.maxRooms)) return false;
    if (filters.privateOnly && offer.isPrivateOwner === false) return false;

    return !filters.hiddenDistricts.includes(offer.district ?? NO_DISTRICT);
  });
}

/**
 * Reads the filters the browser last had set.
 *
 * Local storage is editable by hand and outlives a deploy that changed the shape of this
 * object, so what comes back is untrusted input: each field is checked on its own and
 * anything unreadable becomes no bound at all rather than the default one. Resurrecting
 * a default here would be worse than dropping it, because a cap the owner had cleared
 * would come back silently and hide listings they had just asked to see.
 */
export function readStoredFilters(storage: KeyValueStore): Filters {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readKey(storage, FILTERS_KEY) ?? 'null');
  } catch {
    return DEFAULT_FILTERS;
  }

  // Nothing stored yet, which is the first visit rather than a corrupt key.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    return DEFAULT_FILTERS;
  const stored = parsed as Record<string, unknown>;

  return {
    minCostPln: bound(stored['minCostPln']),
    maxCostPln: bound(stored['maxCostPln']),
    minAreaM2: bound(stored['minAreaM2']),
    maxAreaM2: bound(stored['maxAreaM2']),
    minRooms: bound(stored['minRooms']),
    maxRooms: bound(stored['maxRooms']),
    hiddenDistricts: names(stored['hiddenDistricts']),
    privateOnly: stored['privateOnly'] === true,
    favouritesOnly: stored['favouritesOnly'] === true,
    showRejected: stored['showRejected'] === true,
  };
}

export function writeFilters(storage: KeyValueStore, filters: Filters): void {
  storage.setItem(FILTERS_KEY, JSON.stringify(filters));
}

function bound(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function names(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

/** Only districts present in the data. */
export function availableDistricts(offers: Offer[]): string[] {
  const seen = new Set(offers.map((offer) => offer.district ?? NO_DISTRICT));
  return [...seen].sort((a, b) => a.localeCompare(b, 'pl'));
}

export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'najnowsze' },
  { key: 'cheapest', label: 'najtańsze' },
  { key: 'largest', label: 'największe' },
];

/** Nulls sort last under every key: an unknown value is not a small one. */
function compare(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}

export function sortOffers(offers: Offer[], key: SortKey): Offer[] {
  const time = (offer: Offer) =>
    offer.createdAtSource === null ? null : new Date(offer.createdAtSource).getTime();

  return [...offers].sort((a, b) => {
    if (key === 'cheapest') return compare(a.totalCostPln, b.totalCostPln, 1);
    if (key === 'largest') return compare(a.areaM2, b.areaM2, -1);
    return compare(time(a), time(b), -1);
  });
}
