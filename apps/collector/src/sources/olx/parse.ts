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

function readLabel(params: OlxParam[], key: string): string | null {
  const param = findParam(params, key);
  return param?.value.label ?? null;
}

function toIsoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
    rentPln: readNumericText(offer.params, 'rent'),
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
    status: offer.status === 'active' ? 'active' : 'expired',

    createdAtSource: toIsoOrNull(offer.created_time),
    // pushup_time is sometimes empty despite a bump, so fall back to the refresh time.
    pushedUpAt: toIsoOrNull(offer.pushup_time ?? offer.last_refresh_time),

    raw: offer,
  };
}
