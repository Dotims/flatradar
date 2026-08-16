export type OfferSource = 'olx' | 'otodom' | 'gratka';

/** 'exact' = the portal gives a precise pin, 'approximate' = only the neighbourhood. */
export type CoordsPrecision = 'exact' | 'approximate';

/**
 * The shape every listing is reduced to, whichever portal it came from. Fields are
 * `| null` rather than optional: "the portal did not say" is worth storing.
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
  /**
   * Who placed the advert, as the portal names them: an agency, or whatever a private
   * seller calls themselves. Normalised here so matching the same flat across portals
   * never has to reach into a portal-shaped payload.
   */
  advertiser: string | null;
  status: 'active' | 'expired';

  /** Portal timestamps in ISO 8601 (UTC). */
  createdAtSource: string | null;
  pushedUpAt: string | null;

  /**
   * Photograph URLs as the portal serves them, biggest size first choice, in the order
   * the advertiser arranged them. Normalised here rather than read back out of `raw`
   * later: the dashboard shows the first one on every card, and digging it out of the
   * stored payload at query time measured 1987ms against 193ms for the same list.
   *
   * Empty is normal. OLX ships them with the search results, Otodom only on the ad page,
   * so a listing whose page we never fetched has none.
   */
  photos: string[];

  /** The untouched portal response; goes into the `raw` column. */
  raw: unknown;
}
