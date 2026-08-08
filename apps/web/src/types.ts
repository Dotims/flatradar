export type Tier = 'top' | 'worth' | 'other';
export type CostCertainty = 'exact' | 'all_in' | 'estimated' | 'uncertain';

/**
 * Mirrors `ClassifiedOffer` in the collector. Copied rather than imported: the packages
 * compile with different module settings. Drift throws on the collector side first.
 */
export interface Offer {
  id: number;
  source: string;
  url: string;
  title: string;
  district: string | null;
  areaM2: number | null;
  rooms: number | null;
  floor: string | null;
  pricePln: number | null;
  rentPln: number | null;
  totalCostPln: number | null;
  tier: Tier;
  costCertainty: CostCertainty;
  reasons: string[];
  isPrivateOwner: boolean | null;
  lat: number | null;
  lng: number | null;
  coordsPrecision: string | null;
  createdAtSource: string | null;
  firstSeenAt: string;
}
