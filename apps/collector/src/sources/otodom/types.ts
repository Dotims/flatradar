/**
 * Only the parts of the Otodom response we use. There is no public API; this is the data
 * endpoint Next.js serves its own pages from.
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

/** A path from province down to estate. Used when `address` omits the district. */
export interface OtodomReverseGeocoding {
  locations?: { id: string; fullName: string }[] | null;
}

export interface OtodomLocation {
  address?: OtodomAddress | null;
  reverseGeocoding?: OtodomReverseGeocoding | null;
  mapDetails?: { radius: number } | null;
  coordinates?: { latitude: number; longitude: number } | null;
}

/** A search result. No description and no coordinates. */
export interface OtodomListItem {
  id: number;
  slug: string;
  title: string;
  /** The advertised rent, despite the name: the fee is quoted separately. */
  totalPrice: OtodomMoney | null;
  rentPrice: OtodomMoney | null;
  areaInSquareMeters: number | null;
  roomsNumber: string | null;
  floorNumber: string | null;
  isPrivateOwner: boolean | null;
  /** Only agencies are named on the results page; private sellers are not. */
  agency?: { name?: string | null } | null;
  /** First appearance, as opposed to last edit. */
  createdAtFirst: string | null;
  dateCreated: string | null;
  pushedUpAt: string | null;
  location: OtodomLocation;
}

export interface OtodomSearchResponse {
  pageProps: {
    /** Present instead of `data` on a redirect. */
    __N_REDIRECT?: string;
    data?: {
      searchAds?: {
        items: OtodomListItem[];
        pagination?: { totalPages: number };
      };
    };
  };
}

/** The listing page: description and exact pin. */
export interface OtodomAdResponse {
  pageProps: {
    __N_REDIRECT?: string;
    ad?: {
      id: number;
      slug: string;
      title: string;
      /** HTML, written by a stranger. */
      description: string | null;
      location: OtodomLocation;
      /** Flat map of advert parameters. */
      target?: Record<string, unknown> | null;
      /** The advert page names the agency even where the results page did not. */
      agency?: { name?: string | null } | null;
      owner?: { name?: string | null } | null;
      /** Ready-made sizes, unlike OLX. Only the ad page carries them. */
      images?: OtodomImage[] | null;
    };
  };
}

/** Four ready sizes off the same CDN: 184x138, 314x236, 655x491 and 2048x1536. */
export interface OtodomImage {
  large?: string | null;
  medium?: string | null;
  small?: string | null;
  thumbnail?: string | null;
}
