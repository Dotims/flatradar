import type { NormalizedOffer } from './offer.ts';

/**
 * The same flat, advertised twice. Measured across 3968 live listings: rent, floor area
 * and room count agreeing leaves 2744 candidate pairs, far too many to trust, but title
 * similarity splits them cleanly - 300 pairs above 0.9 and only 53 more all the way down
 * to 0.3. Text decides, not the numbers.
 *
 * District is deliberately not a condition. The portals disagree about it on listings
 * whose descriptions match 95%, so requiring it would throw away real duplicates.
 */
export const TITLE_MATCH = 0.85;
export const DESCRIPTION_MATCH = 0.8;

/**
 * A shared advertiser is corroboration, not proof: the busiest names in the data are
 * agencies with fifty listings, and among private sellers "Anna" covers two dozen
 * different people. It only lowers the bar for text that already half agrees.
 */
export const ADVERTISER_MATCH = 0.7;
export const TITLE_MATCH_SAME_ADVERTISER = 0.35;
export const DESCRIPTION_MATCH_SAME_ADVERTISER = 0.5;

export function normaliseText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Company suffixes say nothing about who the company is. */
export function normaliseAdvertiser(value: string): string {
  return normaliseText(value.replace(/sp\.?\s*z\s*o\.?\s*o\.?|s\.a\.|nieruchomo\p{L}+/giu, ' '));
}

function trigrams(value: string): Set<string> {
  const padded = `  ${value} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** Jaccard overlap of trigrams, the same measure pg_trgm's similarity() reports. */
export function similarity(left: string, right: string): number {
  const a = trigrams(left);
  const b = trigrams(right);
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Rent, floor area to the nearest square metre, and room count. */
export function blockKey(offer: Pick<NormalizedOffer, 'pricePln' | 'areaM2' | 'rooms'>): string {
  if (offer.pricePln === null || offer.areaM2 === null) return '';
  return `${offer.pricePln}|${Math.round(offer.areaM2)}|${offer.rooms ?? -1}`;
}

export type Candidate = Pick<
  NormalizedOffer,
  'title' | 'description' | 'advertiser' | 'pricePln' | 'areaM2' | 'rooms'
>;

/** Assumes the two already share a block key; this only judges the text. */
export function isSameListing(left: Candidate, right: Candidate): boolean {
  const title = similarity(normaliseText(left.title), normaliseText(right.title));
  const description =
    left.description !== null && right.description !== null
      ? similarity(normaliseText(left.description), normaliseText(right.description))
      : 0;

  if (title >= TITLE_MATCH || description >= DESCRIPTION_MATCH) return true;

  const sameAdvertiser =
    left.advertiser !== null &&
    right.advertiser !== null &&
    similarity(normaliseAdvertiser(left.advertiser), normaliseAdvertiser(right.advertiser)) >=
      ADVERTISER_MATCH;

  return (
    sameAdvertiser &&
    (title >= TITLE_MATCH_SAME_ADVERTISER || description >= DESCRIPTION_MATCH_SAME_ADVERTISER)
  );
}

/**
 * Which of the two is worth showing. The map is half the dashboard, so an exact pin wins
 * outright; after that a listing that carries its own description beats one that does not,
 * and a private seller beats an agency.
 */
export function preferred<
  T extends Pick<NormalizedOffer, 'coordsPrecision' | 'description' | 'isPrivateOwner'>,
>(left: T, right: T): T {
  // Compared in order rather than summed: added together, a description and a private
  // seller outweighed an exact pin, which is not what "outright" means.
  const ranks = [
    (offer: T) => (offer.coordsPrecision === 'exact' ? 2 : offer.coordsPrecision === null ? 0 : 1),
    (offer: T) => (offer.description !== null ? 1 : 0),
    (offer: T) => (offer.isPrivateOwner === true ? 1 : 0),
  ];

  for (const rank of ranks) {
    if (rank(right) !== rank(left)) return rank(right) > rank(left) ? right : left;
  }

  return left;
}
