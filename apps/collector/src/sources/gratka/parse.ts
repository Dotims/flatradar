import type { NormalizedOffer } from '../../domain/offer.ts';
import type { GratkaListItem, GratkaSearchPage } from './types.ts';

const ORIGIN = 'https://gratka.pl';

/**
 * The eighteen districts of Kraków, by the slug Gratka writes into an advert's URL:
 * /nieruchomosci/mieszkanie-krakow-debniki-zalesie/ob/48617837.
 *
 * Spelled out rather than folded from the names at runtime, because the fold would have
 * to know that ł does not decompose the way ą and ę do, and because the names on the
 * right have to match the ones OLX and Otodom report to the letter. They are the same
 * strings the dashboard filters on, and a "Dębniki" that arrives as "Debniki" is a
 * nineteenth district nobody asked for.
 *
 * Longest first: the segment for Podgórze Duchackie starts with the one for Podgórze.
 */
const DISTRICTS: [string, string][] = [
  ['wzgorza-krzeslawickie', 'Wzgórza Krzesławickie'],
  ['lagiewniki-borek-falecki', 'Łagiewniki-Borek Fałęcki'],
  ['biezanow-prokocim', 'Bieżanów-Prokocim'],
  ['podgorze-duchackie', 'Podgórze Duchackie'],
  ['pradnik-czerwony', 'Prądnik Czerwony'],
  ['pradnik-bialy', 'Prądnik Biały'],
  ['stare-miasto', 'Stare Miasto'],
  ['mistrzejowice', 'Mistrzejowice'],
  ['swoszowice', 'Swoszowice'],
  ['grzegorzki', 'Grzegórzki'],
  ['zwierzyniec', 'Zwierzyniec'],
  ['bienczyce', 'Bieńczyce'],
  ['krowodrza', 'Krowodrza'],
  ['bronowice', 'Bronowice'],
  ['nowa-huta', 'Nowa Huta'],
  ['podgorze', 'Podgórze'],
  ['czyzyny', 'Czyżyny'],
  ['debniki', 'Dębniki'],
];

/** What the page carries its search results in. Nuxt's own tag, not ours. */
const PAYLOAD_TAG = /<script[^>]*id="__NUXT_DATA__"[^>]*>(.*?)<\/script>/s;

/** Nuxt wraps values it will make reactive in the browser. We want what is inside. */
const WRAPPERS = new Set(['ShallowReactive', 'Reactive', 'Ref', 'ShallowRef', 'EmptyRef']);

/**
 * Walks devalue's flat array back into ordinary values.
 *
 * The rule that matters: a number is an index only where it sits inside a container.
 * Once we have followed it and landed on a number, that number is the value. Reading it
 * as another index is the obvious mistake and a quiet one - `totalCount: 2212` resolves
 * to whatever happens to be at index 2212, which in this payload is a photograph.
 */
function value(payload: unknown[], index: unknown, path: Set<number>): unknown {
  // devalue writes undefined, holes, NaN and the infinities as negative indices.
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) return null;
  if (index >= payload.length || path.has(index)) return null;

  path.add(index);
  try {
    const node = payload[index];

    if (Array.isArray(node)) {
      const [tag, inner] = node;
      if (typeof tag === 'string' && WRAPPERS.has(tag)) return value(payload, inner, path);
      return node.map((item) => value(payload, item, path));
    }

    if (typeof node === 'object' && node !== null) {
      return Object.fromEntries(
        Object.entries(node).map(([key, item]) => [key, value(payload, item, path)]),
      );
    }

    return node;
  } finally {
    path.delete(index);
  }
}

function asRecord(node: unknown): Record<string, unknown> | null {
  return typeof node === 'object' && node !== null && !Array.isArray(node)
    ? (node as Record<string, unknown>)
    : null;
}

/** Follows a path of keys, giving up quietly so the caller can report one clear error. */
function dig(node: unknown, ...keys: string[]): unknown {
  let current = node;
  for (const key of keys) {
    const record = asRecord(current);
    if (record === null) return null;
    current = record[key];
  }
  return current;
}

/**
 * The search results out of a Gratka page.
 *
 * The route's data sits under a key named after the path it was fetched for, so the key
 * is found by its prefix rather than written out: page two's is
 * `property-listing-data-/nieruchomosci/mieszkania/krakow/wynajem?page=2`.
 */
export function readSearchPage(html: string): GratkaSearchPage {
  const match = PAYLOAD_TAG.exec(html);
  if (match?.[1] === undefined) {
    throw new Error('No __NUXT_DATA__ in the Gratka page. The page structure changed.');
  }

  const payload: unknown = JSON.parse(match[1]);
  if (!Array.isArray(payload)) throw new Error('The Gratka payload is not an array.');

  const root = value(payload, 0, new Set());
  const store = asRecord(dig(root, 'data'));
  if (store === null) throw new Error('The Gratka payload carries no data. Structure changed.');

  const key = Object.keys(store).find((name) => name.startsWith('property-listing-data'));
  if (key === undefined) {
    throw new Error('No listing data in the Gratka page. The page structure changed.');
  }

  const properties = dig(store[key], 'data', 'searchResult', 'properties');
  const nodes = dig(properties, 'nodes');
  const totalCount = dig(properties, 'totalCount');
  if (!Array.isArray(nodes)) throw new Error('The Gratka search result carries no listings.');

  return {
    nodes: nodes.filter((node): node is GratkaListItem => {
      const record = asRecord(node);
      return typeof record?.['idOnFrontend'] === 'string' && typeof record['url'] === 'string';
    }),
    totalCount: typeof totalCount === 'number' ? totalCount : nodes.length,
  };
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
}

/** "3300.00" is money, "42" is square metres, and both arrive as strings. */
function toNumber(raw: string | null | undefined): number | null {
  const trimmed = blankToNull(raw);
  if (trimmed === null) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** "2 pokoje", "1 pokój", "kawalerka". */
function toRooms(raw: string | null | undefined): number | null {
  const match = /\d+/.exec(raw ?? '');
  return match === null ? null : Number(match[0]);
}

/** A date with no time. Midnight is a placeholder, not a claim about the hour. */
function toIsoOrNull(raw: string | null | undefined): string | null {
  const trimmed = blankToNull(raw);
  if (trimmed === null) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * The district, read out of the advert's own URL.
 *
 * Gratka gives a street and a city and never a district, and the listing carries no
 * coordinates to derive one from. The URL slug does carry it, for about four adverts in
 * five; the rest keep a null district and show up in the dashboard as having none, which
 * is what a listing with no district means everywhere else too.
 */
export function districtFromUrl(url: string): string | null {
  const slug = url.split('/ob/')[0]?.split('/').pop() ?? '';
  const city = 'mieszkanie-krakow-';
  if (!slug.startsWith(city)) return null;

  const rest = slug.slice(city.length);
  for (const [name, district] of DISTRICTS) {
    if (rest === name || rest.startsWith(`${name}-`)) return district;
  }
  return null;
}

/** Their CDN addresses pictures by a base64 of the URL. Anything else is not a picture. */
function toPhotoUrls(photos: GratkaListItem['photos']): string[] {
  const out: string[] = [];

  for (const photo of photos ?? []) {
    const decoded = Buffer.from(photo.id, 'base64').toString('utf8');
    if (decoded.startsWith('https://')) out.push(decoded);
  }

  return out;
}

/**
 * Who placed it. An advert with a company on it is an agency's unless the company is
 * flagged as the owner; one with no company at all is a private advertiser.
 */
function readOwnership(contact: GratkaListItem['contact']): {
  isPrivateOwner: boolean | null;
  advertiser: string | null;
} {
  const company = contact?.company ?? null;
  const person = blankToNull(contact?.person?.name);

  if (company === null) {
    return {
      isPrivateOwner: contact === null || contact === undefined ? null : true,
      advertiser: person,
    };
  }

  return {
    isPrivateOwner: company.type === 'OWNER',
    advertiser: blankToNull(company.name) ?? person,
  };
}

export function parseGratkaOffer(item: GratkaListItem): NormalizedOffer {
  const url = `${ORIGIN}${item.url}`;
  const { isPrivateOwner, advertiser } = readOwnership(item.contact);
  // The headline the advertiser wrote. `title` is the category, the same six words on
  // every advert, and dedupe compares titles: identical text would make two different
  // flats with the same rent and floor area look like one.
  const title = blankToNull(item.advertisementText) ?? blankToNull(item.title) ?? 'Mieszkanie';

  return {
    source: 'gratka',
    sourceId: item.idOnFrontend,
    url,
    title,
    description: blankToNull(item.description),

    pricePln: toNumber(item.price?.amount) === null ? null : Math.round(Number(item.price?.amount)),
    // Gratka does not carry the building fee in its search results at all, so every
    // listing from here meets the documented 400 PLN assumption and is marked estimated.
    rentPln: null,
    depositPln: null,

    areaM2: toNumber(item.area),
    rooms: toRooms(item.numberOfRooms),
    floor: blankToNull(item.floorFormatted),

    city: blankToNull(item.location?.location?.at(-1)) ?? 'Kraków',
    district: districtFromUrl(url),
    subdistrict: null,
    street: blankToNull(item.location?.street),
    // No coordinates anywhere in the payload, so these listings have no pin. The dedupe
    // preference already treats a listing with an exact pin as the better copy.
    lat: null,
    lng: null,
    coordsPrecision: null,

    isPrivateOwner,
    advertiser,
    status: 'active',

    createdAtSource: toIsoOrNull(item.addedAt),
    pushedUpAt: toIsoOrNull(item.refreshedAt),

    photos: toPhotoUrls(item.photos),
    raw: item,
  };
}
