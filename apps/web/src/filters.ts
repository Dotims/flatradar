import type { Offer, Tier } from './types.ts';

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
 */
export function applyFilters(offers: Offer[], filters: Filters): Offer[] {
  return offers.filter((offer) => {
    if (offer.totalCostPln !== null && offer.totalCostPln > filters.maxCostPln) return false;
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
