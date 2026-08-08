export type OfferSource = 'olx' | 'otodom';

/** 'exact' = the portal gives a precise pin, 'approximate' = only the neighbourhood. */
export type CoordsPrecision = 'exact' | 'approximate';

/**
 * The shape every listing is reduced to, whichever portal it came from. OLX and Otodom
 * return completely different structures; everything downstream (classifier, database,
 * dashboard) sees only this.
 *
 * Fields are `| null` rather than optional, because "the portal did not say" is itself
 * information worth storing instead of quietly dropping.
 */
export interface NormalizedOffer {
  source: OfferSource;
  sourceId: string;
  url: string;
  title: string;
  description: string | null;

  /** Amounts in whole PLN. */
  pricePln: number | null;
  rentPln: number | null;
  depositPln: number | null;

  areaM2: number | null;
  rooms: number | null;
  floor: string | null;

  city: string;
  district: string | null;
  subdistrict: string | null;
  street: string | null;
  lat: number | null;
  lng: number | null;
  coordsPrecision: CoordsPrecision | null;

  isPrivateOwner: boolean | null;
  status: 'active' | 'expired';

  /** Portal timestamps in ISO 8601 (UTC). */
  createdAtSource: string | null;
  pushedUpAt: string | null;

  /** The untouched portal response; goes into the `raw` column. */
  raw: unknown;
}
