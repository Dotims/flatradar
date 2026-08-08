/**
 * Districts ruled out for this search. The list is small and personal, so it lives in
 * code rather than in a settings file; changing it means editing one array and running
 * the classifier again, never refetching anything.
 *
 * Spelling follows what the portals actually return (checked against live OLX data).
 */
const EXCLUDED_DISTRICTS = [
  'Bieńczyce',
  'Bronowice',
  'Czyżyny',
  'Grzegórzki',
  'Krowodrza',
  'Prądnik Biały',
  'Prądnik Czerwony',
  'Stare Miasto',
  'Zwierzyniec',
];

/** Portals differ in casing and stray whitespace; the district itself is the same place. */
function normalise(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

const EXCLUDED = new Set(EXCLUDED_DISTRICTS.map(normalise));

/**
 * A listing with no district set is kept on purpose. Advertisers leave the field blank
 * often enough that dropping those would hide real offers, and the map can settle it
 * later. Only a district we recognise as excluded rules a listing out.
 */
export function isExcludedDistrict(district: string | null): boolean {
  if (district === null) return false;
  return EXCLUDED.has(normalise(district));
}
