/**
 * Only the parts of a Gratka listing we use.
 *
 * Gratka is a Nuxt application and ships the search results inside the page, in the
 * `__NUXT_DATA__` script tag, as JSON. There is no separate data endpoint the way Otodom
 * has one: `_payload.json` exists but is a cached prerender of page one that ignores
 * `?page=` and `?sort=`, so it can never see anything but the first thirty five.
 *
 * The payload is devalue-flattened: one flat array where every value is an index into
 * that same array, so a string used in forty listings is stored once. `parse.ts` walks it
 * back into the shapes below.
 */

/** Amounts arrive as strings: "3300.00". */
export interface GratkaMoney {
  amount: string;
  currency: string;
}

/** Voivodeship and city as a path, plus a street name when the advert gives one. */
export interface GratkaLocation {
  location?: string[] | null;
  street?: string | null;
}

/**
 * The photograph URL is base64 in `id`, which is how their CDN addresses them. `alt` and
 * `name` are captions, not addresses.
 */
export interface GratkaPhoto {
  id: string;
  alt?: string | null;
  name?: string | null;
}

/** An agency, a private advertiser, or both when an agent lists under a company. */
export interface GratkaContact {
  company?: { name?: string | null; type?: string | null } | null;
  person?: { name?: string | null } | null;
}

export interface GratkaListItem {
  /** The number in the advert's own URL, and what we store as `source_id`. */
  idOnFrontend: string;
  /** Their internal id. Kept for `raw` only; it is not the one the site links by. */
  id?: number | null;
  /** Relative, as "/nieruchomosci/mieszkanie-krakow-krowodrza-wroclawska/ob/48632201". */
  url: string;
  /** Always the category, "mieszkanie na wynajem". The headline is advertisementText. */
  title?: string | null;
  /** What the advertiser wrote as a headline: "Klima | Garaż | Zmywarka | Balkon". */
  advertisementText?: string | null;
  description?: string | null;
  /** The advertised rent. The building fee is not in the search results at all. */
  price?: GratkaMoney | null;
  /** Square metres, as a string. */
  area?: string | null;
  /** Written out: "2 pokoje", "1 pokój". */
  numberOfRooms?: string | null;
  /** Written out: "piętro 6/7", "parter". */
  floorFormatted?: string | null;
  location?: GratkaLocation | null;
  photos?: GratkaPhoto[] | null;
  contact?: GratkaContact | null;
  /** A date without a time: "2026-08-15". */
  addedAt?: string | null;
  refreshedAt?: string | null;
}

/** What one search page yields, once the payload has been walked back. */
export interface GratkaSearchPage {
  nodes: GratkaListItem[];
  totalCount: number;
}
