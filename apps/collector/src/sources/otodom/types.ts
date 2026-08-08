/**
 * Only the parts of the Otodom response we actually use.
 *
 * Otodom has no public API. What we read is the data endpoint Next.js exposes for its
 * own pages: the same payload the search page receives, without the HTML around it. The
 * `__typename` fields dotted through it are GraphQL leaking from the layer underneath.
 */

export interface OtodomMoney {
  value: number;
  currency: string;
}

export interface OtodomStreet {
  name: string | null;
  number: string | null;
}

export interface OtodomAddress {
  street?: OtodomStreet | null;
  district?: { name: string } | null;
  subdistrict?: { name: string } | null;
  city?: { name: string } | null;
}

/**
 * Otodom describes a location twice. `address` is the structured version and is often
 * incomplete; `reverseGeocoding.locations` is a path from province down to estate, where
 * the last entry is the most specific. The district is read from whichever has it.
 */
export interface OtodomReverseGeocoding {
  locations?: { id: string; fullName: string }[] | null;
}

export interface OtodomLocation {
  address?: OtodomAddress | null;
  reverseGeocoding?: OtodomReverseGeocoding | null;
  mapDetails?: { radius: number } | null;
  coordinates?: { latitude: number; longitude: number } | null;
}

/** A listing as it appears in search results. No description and no coordinates here. */
export interface OtodomListItem {
  id: number;
  slug: string;
  title: string;
  /** The advertised rent. Otodom calls it "total" but the building fee is separate. */
  totalPrice: OtodomMoney | null;
  rentPrice: OtodomMoney | null;
  areaInSquareMeters: number | null;
  roomsNumber: string | null;
  floorNumber: string | null;
  isPrivateOwner: boolean | null;
  /** When the listing first appeared, as opposed to when it was last edited. */
  createdAtFirst: string | null;
  dateCreated: string | null;
  pushedUpAt: string | null;
  location: OtodomLocation;
}

export interface OtodomSearchResponse {
  pageProps: {
    /** Present instead of `data` when Next.js answers with a redirect. */
    __N_REDIRECT?: string;
    data?: {
      searchAds?: {
        items: OtodomListItem[];
        pagination?: { totalPages: number };
      };
    };
  };
}

/** The listing page, which is where the description and the exact pin live. */
export interface OtodomAdResponse {
  pageProps: {
    __N_REDIRECT?: string;
    ad?: {
      id: number;
      slug: string;
      title: string;
      /** HTML, written by whoever placed the ad. */
      description: string | null;
      location: OtodomLocation;
      /** Flat map of the advert parameters; rent and price arrive here as numbers. */
      target?: Record<string, unknown> | null;
    };
  };
}
