/**
 * Only the parts of the OLX response we actually use. The portal returns dozens of
 * other fields (seller details, ad slots, delivery settings), and describing all of
 * them would mean every change on their side breaks our types.
 */

export interface OlxPriceValue {
  value: number;
  currency: string;
  label: string;
}

/** Non-price params carry their value as a string in `key`, e.g. "45". */
export interface OlxSelectValue {
  key: string | string[];
  label: string;
}

export interface OlxParam {
  key: string;
  name: string;
  type: string;
  value: OlxPriceValue | OlxSelectValue;
}

export interface OlxLocation {
  city: { id: number; name: string };
  district?: { id: number; name: string } | null;
  region: { id: number; name: string };
}

export interface OlxMap {
  lat: number;
  lon: number;
  /** 0 would mean an exact pin; OLX reports a neighbourhood, so this is usually > 0. */
  radius: number;
  zoom: number;
}

export interface OlxOffer {
  id: number;
  url: string;
  title: string;
  description: string;
  created_time: string;
  last_refresh_time: string | null;
  pushup_time: string | null;
  status: string;
  /** true = business account (agency, developer), false = private individual. */
  business: boolean;
  /** A company trades under `company_name`; a private seller has only a display name. */
  user?: { name?: string | null; company_name?: string | null } | null;
  params: OlxParam[];
  location: OlxLocation;
  map: OlxMap;
}

export interface OlxOffersResponse {
  data: OlxOffer[];
  metadata: { total_elements: number; visible_total_count: number };
}
