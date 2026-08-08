/** Districts ruled out. Spelling follows what the portals return. */
const EXCLUDED_DISTRICTS = [
  'Bieńczyce',
  'Bronowice',
  'Czyżyny',
  'Grzegórzki',
  'Krowodrza',
  'Mistrzejowice',
  'Prądnik Biały',
  'Prądnik Czerwony',
  'Stare Miasto',
  'Zwierzyniec',
];

function normalise(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

const EXCLUDED = new Set(EXCLUDED_DISTRICTS.map(normalise));

/** A listing with no district is kept: advertisers leave the field blank too often. */
export function isExcludedDistrict(district: string | null): boolean {
  if (district === null) return false;
  return EXCLUDED.has(normalise(district));
}
