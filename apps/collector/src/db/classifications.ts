import type { DatabaseSync } from 'node:sqlite';
import type { Classification, CostCertainty, Tier } from '../domain/classify.ts';
import {
  readNullableBoolean,
  readNullableNumber,
  readNullableString,
  readNumber,
  readString,
  type DbRow,
} from './rows.ts';

const SAVE_SQL = `
  insert into classifications (
    offer_id, tier, total_cost_pln, cost_certainty, reasons, rules_version, classified_at
  ) values (?, ?, ?, ?, ?, ?, ?)
  on conflict (offer_id) do update set
    tier           = excluded.tier,
    total_cost_pln = excluded.total_cost_pln,
    cost_certainty = excluded.cost_certainty,
    reasons        = excluded.reasons,
    rules_version  = excluded.rules_version,
    classified_at  = excluded.classified_at
`;

/**
 * One verdict per listing, replaced whenever the rules change. There is no history here
 * on purpose: an old verdict under old thresholds is not worth keeping, and the facts it
 * was derived from are all still in `offers`.
 */
export function saveClassification(
  db: DatabaseSync,
  offerId: number,
  classification: Classification,
  rulesVersion: number,
  classifiedAt: string = new Date().toISOString(),
): void {
  db.prepare(SAVE_SQL).run(
    offerId,
    classification.tier,
    classification.totalCostPln,
    classification.costCertainty,
    // Stored as JSON so the dashboard can list the reasons separately rather than
    // splitting a sentence back apart.
    JSON.stringify(classification.reasons),
    rulesVersion,
    classifiedAt,
  );
}

/**
 * One listing as the dashboard needs it: the portal facts and our verdict, already
 * joined. Deliberately without the description, which is HTML written by a stranger and
 * has no business travelling to a browser until something is responsible for escaping it.
 */
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

function toReasons(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new Error('The reasons column does not hold a list of strings.');
  }
  return parsed;
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
    reasons: toReasons(readString(row, 'reasons')),
    isPrivateOwner: readNullableBoolean(row, 'is_private_owner'),
    lat: readNullableNumber(row, 'lat'),
    lng: readNullableNumber(row, 'lng'),
    coordsPrecision: readNullableString(row, 'coords_precision'),
    createdAtSource: readNullableString(row, 'created_at_source'),
    firstSeenAt: readString(row, 'first_seen_at'),
  };
}

/**
 * Everything the dashboard can show, cheapest first. Filtering happens in the browser:
 * the whole set is a few hundred rows, so sending it once beats a round trip per slider
 * move, and the filters stay instant.
 */
export function listClassifiedOffers(db: DatabaseSync): ClassifiedOffer[] {
  return db
    .prepare(
      `select o.id, o.source, o.url, o.title, o.district, o.area_m2, o.rooms, o.floor,
              o.price_pln, o.rent_pln, o.is_private_owner, o.lat, o.lng, o.coords_precision,
              o.created_at_source, o.first_seen_at,
              c.tier, c.total_cost_pln, c.cost_certainty, c.reasons
       from classifications c
       join offers o on o.id = c.offer_id
       where o.status = 'active'
       -- Tier first, then price. Sorting on price alone put a cheap listing whose real
       -- cost is unknown above a pricier one that actually fits the budget.
       order by case c.tier when 'top' then 0 when 'worth' then 1 else 2 end,
                c.total_cost_pln`,
    )
    .all()
    .map(toClassifiedOffer);
}
