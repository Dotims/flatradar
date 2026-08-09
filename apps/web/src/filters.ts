import type { Offer, SortKey, Tier } from './types.ts';

export interface Filters {
  /** Upper bound on the full monthly cost, in PLN. */
  maxCostPln: number;
  /** Lower bound on the floor area, in square metres. */
  minAreaM2: number;
  tiers: Tier[];
  districts: string[];
  privateOnly: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  maxCostPln: 2600,
  minAreaM2: 0,
  tiers: ['top', 'worth'],
  districts: [],
  privateOnly: false,
};

export const NO_DISTRICT = '(brak dzielnicy)';

/**
 * Free of React so it can be tested directly. A listing missing the value a filter asks
 * about is kept: half the portal fields are optional.
 *
 * The cost cap does not apply to `worth`. That tier is defined as a total above the
 * all-in limit, so capping it by total made the whole tier unreachable whenever the cap
 * sat at the budget: the pill was lit, the count said six, and the list held none.
 */
export function applyFilters(offers: Offer[], filters: Filters): Offer[] {
  return offers.filter((offer) => {
    const cappedByCost = offer.tier !== 'worth';
    if (cappedByCost && offer.totalCostPln !== null && offer.totalCostPln > filters.maxCostPln) {
      return false;
    }
    if (offer.areaM2 !== null && offer.areaM2 < filters.minAreaM2) return false;
    if (filters.tiers.length > 0 && !filters.tiers.includes(offer.tier)) return false;
    if (filters.privateOnly && offer.isPrivateOwner === false) return false;

    if (filters.districts.length > 0) {
      const district = offer.district ?? NO_DISTRICT;
      if (!filters.districts.includes(district)) return false;
    }

    return true;
  });
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
