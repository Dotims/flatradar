export type Tier = 'top' | 'worth' | 'other';
export type CostCertainty = 'exact' | 'all_in' | 'estimated' | 'uncertain';

/**
 * Mirrors `ClassifiedOffer` in the collector. Declared again rather than imported: the
 * two packages are compiled with different module settings, and a copied interface is a
 * cheaper price than wiring project references for one type. If it drifts, the reader
 * functions on the collector side throw before anything reaches here.
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
