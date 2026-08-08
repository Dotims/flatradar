import type { NormalizedOffer } from '../../domain/offer.ts';
import type { OtodomAdResponse, OtodomListItem, OtodomLocation } from './types.ts';

type OtodomAd = NonNullable<OtodomAdResponse['pageProps']['ad']>;

/** Otodom names the room count instead of counting it, and stops being exact at ten. */
const ROOMS_BY_NAME: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
  SIX: 6,
  SEVEN: 7,
  EIGHT: 8,
  NINE: 9,
  TEN: 10,
};

/**
 * A district sits at the fifth level of the reverse geocoding path:
 * `malopolskie/krakow/krakow/krakow/pradnik-czerwony`. Anything shorter is the city or
 * the province, anything longer is an estate inside the district.
 */
const DISTRICT_DEPTH = 5;

function districtFromGeocoding(location: OtodomLocation): string | null {
  const locations = location.reverseGeocoding?.locations ?? [];

  for (const entry of locations) {
    if (entry.id.split('/').length !== DISTRICT_DEPTH) continue;
    // fullName reads "Prądnik Czerwony, Kraków, małopolskie"; only the head is the name.
    const name = entry.fullName.split(',')[0]?.trim();
    if (name !== undefined && name !== '') return name;
  }

  return null;
}

/** The structured address is the better source when present, and often is not. */
function readDistrict(location: OtodomLocation): string | null {
  return location.address?.district?.name ?? districtFromGeocoding(location);
}

function toIsoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toWholePln(money: { value: number } | null | undefined): number | null {
  if (money === null || money === undefined) return null;
  return Math.round(money.value);
}

/**
 * A listing, from the search results and optionally from its own page. The detail is
 * separate because it costs an extra request each, so it is only fetched for listings
 * that survived the cheap filters. Without it there is no description and no exact pin,
 * which the nulls below record honestly rather than papering over.
 */
export function parseOtodomOffer(item: OtodomListItem, ad?: OtodomAd): NormalizedOffer {
  const coordinates = ad?.location.coordinates ?? null;
  const radius = ad?.location.mapDetails?.radius ?? item.location.mapDetails?.radius ?? null;

  return {
    source: 'otodom',
    sourceId: String(item.id),
    url: `https://www.otodom.pl/pl/oferta/${item.slug}`,
    title: item.title,
    description: ad?.description ?? null,

    // Otodom calls the advertised rent "totalPrice" even though the building fee is
    // quoted separately, so the naming here follows what the numbers mean, not its label.
    pricePln: toWholePln(item.totalPrice),
    rentPln: toWholePln(item.rentPrice),
    depositPln: null,

    areaM2: item.areaInSquareMeters,
    rooms: item.roomsNumber === null ? null : (ROOMS_BY_NAME[item.roomsNumber] ?? null),
    floor: item.floorNumber,

    city: item.location.address?.city?.name ?? 'Kraków',
    district: readDistrict(item.location),
    subdistrict: item.location.address?.subdistrict?.name ?? null,
    street: item.location.address?.street?.name ?? null,
    lat: coordinates?.latitude ?? null,
    lng: coordinates?.longitude ?? null,
    // Otodom gives a real pin rather than the blurred circle OLX reports, but only on
    // the listing page. Precision stays unknown until that page has been read.
    coordsPrecision: coordinates === null ? null : radius === 0 ? 'exact' : 'approximate',

    isPrivateOwner: item.isPrivateOwner,
    status: 'active',

    // createdAtFirst is when the listing first appeared; dateCreated moves when the
    // advertiser edits it, so it would make an old flat look new.
    createdAtSource: toIsoOrNull(item.createdAtFirst ?? item.dateCreated),
    pushedUpAt: toIsoOrNull(item.pushedUpAt),

    raw: ad === undefined ? item : { item, ad },
  };
}
