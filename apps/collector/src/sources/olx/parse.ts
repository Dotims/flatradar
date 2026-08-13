import type { NormalizedOffer } from '../../domain/offer.ts';
import type { OlxOffer, OlxParam, OlxPriceValue } from './types.ts';

/** OLX encodes the room count as a word and stops being exact above three. */
const ROOMS_BY_KEY: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four_and_more: 4,
};

function findParam(params: OlxParam[], key: string): OlxParam | undefined {
  return params.find((param) => param.key === key);
}

function isPriceValue(value: OlxParam['value']): value is OlxPriceValue {
  return 'value' in value && typeof value.value === 'number';
}

/** Price params keep the number in a nested object. */
function readPrice(params: OlxParam[], key: string): number | null {
  const param = findParam(params, key);
  if (!param || !isPriceValue(param.value)) return null;
  return Math.round(param.value.value);
}

/**
 * The building fee and the floor area arrive as text ("990", "45.5"), and sometimes
 * as an empty string when the advertiser left the field blank.
 */
function readNumericText(params: OlxParam[], key: string): number | null {
  const param = findParam(params, key);
  if (!param || isPriceValue(param.value)) return null;
  const raw = Array.isArray(param.value.key) ? param.value.key[0] : param.value.key;
  if (raw === undefined || raw.trim() === '') return null;
  const parsed = Number(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function readWholePln(params: OlxParam[], key: string): number | null {
  const value = readNumericText(params, key);
  return value === null ? null : Math.round(value);
}

function readLabel(params: OlxParam[], key: string): string | null {
  const param = findParam(params, key);
  return param?.value.label ?? null;
}

/** OLX sends an empty string for a company name a private seller does not have. */
function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
}

function toIsoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * OLX serves one templated URL per photograph and lets the caller name the size. 800x600
 * is the card thumbnail with room to spare, and asking for the original would pull a
 * multi-megabyte file into a grid of them.
 */
const OLX_PHOTO_SIZE = '800x600';

function readPhotos(offer: OlxOffer): string[] {
  if (!Array.isArray(offer.photos)) return [];
  return offer.photos.map((photo) => photo.link.replace('{width}x{height}', OLX_PHOTO_SIZE));
}

export function parseOlxOffer(offer: OlxOffer): NormalizedOffer {
  const roomsValue = findParam(offer.params, 'rooms')?.value;
  const roomsCode =
    roomsValue && !isPriceValue(roomsValue) && typeof roomsValue.key === 'string'
      ? roomsValue.key
      : null;

  return {
    source: 'olx',
    sourceId: String(offer.id),
    url: offer.url,
    title: offer.title,
    description: offer.description || null,

    pricePln: readPrice(offer.params, 'price'),
    // Advertisers sometimes type a fractional fee, e.g. "1130.27".
    rentPln: readWholePln(offer.params, 'rent'),
    // OLX has no separate deposit field; it only ever shows up in the description.
    depositPln: null,

    areaM2: readNumericText(offer.params, 'm'),
    rooms: roomsCode ? (ROOMS_BY_KEY[roomsCode] ?? null) : null,
    floor: readLabel(offer.params, 'floor_select'),

    city: offer.location.city.name,
    district: offer.location.district?.name ?? null,
    subdistrict: null,
    street: null,
    lat: offer.map.lat,
    lng: offer.map.lon,
    // OLX blurs the location deliberately: it gives the centre of an area and a radius.
    coordsPrecision: offer.map.radius === 0 ? 'exact' : 'approximate',

    isPrivateOwner: !offer.business,
    // The trading name where there is one; otherwise whatever the seller calls themselves.
    advertiser: blankToNull(offer.user?.company_name) ?? blankToNull(offer.user?.name),
    status: offer.status === 'active' ? 'active' : 'expired',

    createdAtSource: toIsoOrNull(offer.created_time),
    // pushup_time is sometimes empty despite a bump, so fall back to the refresh time.
    pushedUpAt: toIsoOrNull(offer.pushup_time ?? offer.last_refresh_time),

    photos: readPhotos(offer),
    raw: offer,
  };
}
