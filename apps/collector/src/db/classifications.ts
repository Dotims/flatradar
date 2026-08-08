import type { Classification, CostCertainty, Tier } from '../domain/classify.ts';
import type { Queryable } from './client.ts';
import {
  readIso,
  readNullableBoolean,
  readNullableIso,
  readNullableNumber,
  readNullableString,
  readNumber,
  readString,
  readStringArray,
  type DbRow,
} from './rows.ts';

/** One verdict per listing, replaced when the rules change. `offers` keeps the facts. */
export async function saveClassification(
  sql: Queryable,
  offerId: number,
  classification: Classification,
  rulesVersion: number,
): Promise<void> {
  await sql`
    insert into classifications (
      offer_id, tier, total_cost_pln, cost_certainty, reasons, rules_version, classified_at
    ) values (
      ${offerId}, ${classification.tier}, ${classification.totalCostPln},
      ${classification.costCertainty}, ${JSON.stringify(classification.reasons)},
      ${rulesVersion}, now()
    )
    on conflict (offer_id) do update set
      tier           = excluded.tier,
      total_cost_pln = excluded.total_cost_pln,
      cost_certainty = excluded.cost_certainty,
      reasons        = excluded.reasons,
      rules_version  = excluded.rules_version,
      classified_at  = excluded.classified_at
  `;
}

/** Facts and verdict, joined. No description: it is HTML written by a stranger. */
export interface ClassifiedOffer {
  id: number;
  source: string;
  url: string;
  title: string;
  district: string | null;
  areaM2: number | null;
  rooms: number | null;
  floor: string | null;
  pricePln: number | null;
  rentPln: number | null;
  totalCostPln: number | null;
  tier: Tier;
  costCertainty: CostCertainty;
  reasons: string[];
  isPrivateOwner: boolean | null;
  lat: number | null;
  lng: number | null;
  coordsPrecision: string | null;
  createdAtSource: string | null;
  firstSeenAt: string;
}

function toTier(value: string): Tier {
  if (value === 'top' || value === 'worth' || value === 'other') return value;
  throw new Error(`Unknown tier "${value}".`);
}

function toCertainty(value: string): CostCertainty {
  if (value === 'exact' || value === 'all_in' || value === 'estimated' || value === 'uncertain') {
    return value;
  }
  throw new Error(`Unknown cost certainty "${value}".`);
}

function toClassifiedOffer(row: DbRow): ClassifiedOffer {
  return {
    id: readNumber(row, 'id'),
    source: readString(row, 'source'),
    url: readString(row, 'url'),
    title: readString(row, 'title'),
    district: readNullableString(row, 'district'),
    areaM2: readNullableNumber(row, 'area_m2'),
    rooms: readNullableNumber(row, 'rooms'),
    floor: readNullableString(row, 'floor'),
    pricePln: readNullableNumber(row, 'price_pln'),
    rentPln: readNullableNumber(row, 'rent_pln'),
    totalCostPln: readNullableNumber(row, 'total_cost_pln'),
    tier: toTier(readString(row, 'tier')),
    costCertainty: toCertainty(readString(row, 'cost_certainty')),
    reasons: readStringArray(row, 'reasons'),
    isPrivateOwner: readNullableBoolean(row, 'is_private_owner'),
    lat: readNullableNumber(row, 'lat'),
    lng: readNullableNumber(row, 'lng'),
    coordsPrecision: readNullableString(row, 'coords_precision'),
    createdAtSource: readNullableIso(row, 'created_at_source'),
    firstSeenAt: readIso(row, 'first_seen_at'),
  };
}

/** Everything the dashboard shows. A few hundred rows, so it is sent once and filtered there. */
export async function listClassifiedOffers(sql: Queryable): Promise<ClassifiedOffer[]> {
  const rows = await sql<DbRow[]>`
    select o.id, o.source, o.url, o.title, o.district, o.area_m2, o.rooms, o.floor,
           o.price_pln, o.rent_pln, o.is_private_owner, o.lat, o.lng, o.coords_precision,
           o.created_at_source, o.first_seen_at,
           c.tier, c.total_cost_pln, c.cost_certainty, c.reasons
    from classifications c
    join offers o on o.id = c.offer_id
    where o.status = 'active'
    -- Tier first: on price alone, a cheap unknown outranks a pricier listing that fits.
    order by case c.tier when 'top' then 0 when 'worth' then 1 else 2 end, c.total_cost_pln
  `;

  return rows.map(toClassifiedOffer);
}
