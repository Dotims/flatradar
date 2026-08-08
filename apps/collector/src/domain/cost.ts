/**
 * Reading monthly costs out of the listing description.
 *
 * Both portals give the rent and the building fee as structured numbers, but everything
 * else is prose, written by whoever placed the ad: "media 600 zl", "prąd: około 150 zł",
 * "prąd według zużycia", "już ze wszystkim". This module reports only what a description
 * actually says. It never estimates and never judges; deciding what a silence is worth
 * belongs in `classify.ts`, where the thresholds live.
 */

export interface DescriptionCosts {
  /** Utilities stated on top of rent and building fee, in whole PLN. */
  utilitiesPln: number | null;
  /** The description claims the advertised price covers everything. */
  allIn: boolean;
  /** The description says there is no building fee at all. */
  noFee: boolean;
  /**
   * Whether utilities come up at all. It does not change any total, but "says nothing
   * about media" and "says media are metered without giving a figure" are different
   * situations to look at, so the reason line keeps them apart.
   */
  mentionsUtilities: boolean;
}

/**
 * Descriptions arrive as HTML. This flattening is for pattern matching only; the
 * dashboard must escape the original text itself rather than trust anything here.
 */
export function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+/g, ' ')
    .toLowerCase();
}

/** "wszystko w cenie", "media wliczone", "już ze wszystkim". */
const ALL_IN_PATTERNS = [
  /(?:media|mediami|opłat\w*|wszystk\w*|liczniki)[^.\n]{0,30}?(?:w cenie|wliczon\w*|w czynszu)/,
  /(?:w cenie|wliczon\w*)[^.\n]{0,30}?(?:media|mediami|opłat\w*|wszystk\w*)/,
  /ze wszystkim/,
  /bez dodatkowych opłat/,
];

/** Words that mean the description is talking about utilities at all. */
const UTILITY_MENTION = /\b(?:media|mediów|mediami|prąd\w*|gaz\w*|wod[ayę]|liczniki|zużyci\w*)\b/;

/**
 * "bez czynszu", "brak czynszu administracyjnego". Rare, but it is the difference
 * between assuming a fee and knowing there is none, which is worth several hundred
 * PLN a month in the verdict.
 */
const NO_FEE_PATTERNS = [
  /(?:bez|brak|nie ma|zero)\s+(?:opłat\w*\s+)?czynsz\w*/,
  /czynsz\w*[^.\n]{0,15}?(?:0|brak|zero)\s*(?:zł|zl|pln)?\b/,
];

// A sum with an optional thousands separator, followed by a currency: "600 zl", "1 200 zł".
const MONEY = String.raw`(\d{1,2}[\s.]?\d{3}|\d{2,4})\s*(?:zł|zl|pln)`;

/**
 * Words allowed to introduce a utility figure. Narrow on purpose. "gaz" and "woda" were
 * here and had to go: they match "kuchenka gazowa" and "ciepła woda z sieci miejskiej",
 * which sit next to unrelated numbers, and one description even matched "gazrażu".
 */
const AMOUNT_WORD = String.raw`(?:media|mediów|mediami|prąd\w*|opłat\w*)`;

/** "media 650 zł", "prąd według zużycia około 120zł", "zaliczka na prąd 70 zł". */
const AMOUNT_AFTER_WORD = new RegExp(`${AMOUNT_WORD}[^.\\n]{0,25}?${MONEY}`, 'g');
/**
 * "850 zł opłat dodatkowych". Only "opłat" is allowed to follow an amount: letting any
 * utility word do it turns "czynsz administracyjny 1064 pln + prąd" into 1064 PLN of
 * utilities, when that number is the building fee the portal already reports separately.
 */
const AMOUNT_BEFORE_WORD = new RegExp(`${MONEY}[^.\\n]{0,10}?opłat\\w*`, 'g');

/**
 * A figure surrounded by any of these is not utilities. The building fee is the dangerous
 * one: it arrives as its own column, so counting it again out of the prose would inflate
 * every total and quietly push affordable flats out of the priority tier.
 *
 * "najem" is deliberately absent. It reads like an obvious thing to block, but it blocked
 * "cena najmu 2700 zł + ok. 850 zł opłat dodatkowych", which states the extras perfectly
 * clearly. The rent itself is already kept out by the upper bound below: no rent in
 * Kraków lands under 1500 PLN.
 */
const NOT_UTILITIES =
  /czynsz|administracyjn|eksploatacyjn|spółdziel|kaucj|garaż|gazraż|parking|postojow|piwnic/;

/**
 * How much surrounding text is inspected for the words above. The window reaches further
 * back than forward because Polish puts the qualifier first: "w garażu podziemnym za
 * dodatkową opłatą 400 zł" needs 40 characters of hindsight to be recognised as parking.
 */
const CONTEXT_BEFORE = 40;
const CONTEXT_AFTER = 20;

/**
 * Utilities outside this range are almost certainly not utilities: a two digit figure is
 * usually an internet add-on quoted separately, and anything above this is the rent that
 * happened to sit next to the word.
 */
const MIN_UTILITIES_PLN = 30;
const MAX_UTILITIES_PLN = 1_500;

function toAmount(digits: string): number | null {
  const value = Number(digits.replace(/[\s.]/g, ''));
  if (!Number.isFinite(value)) return null;
  if (value < MIN_UTILITIES_PLN || value > MAX_UTILITIES_PLN) return null;

  return value;
}

/**
 * Walks every match rather than trusting the first one. Descriptions routinely list the
 * building fee before the utilities ("opłaty administracyjne 680 zł, zaliczka na prąd
 * 70 zł"), so the first hit is often the wrong number and the second is the right one.
 */
function firstUsableAmount(text: string, pattern: RegExp): number | null {
  for (const match of text.matchAll(pattern)) {
    const digits = match[1];
    if (digits === undefined) continue;

    const start = Math.max(0, match.index - CONTEXT_BEFORE);
    const end = match.index + match[0].length + CONTEXT_AFTER;
    if (NOT_UTILITIES.test(text.slice(start, end))) continue;

    const amount = toAmount(digits);
    if (amount !== null) return amount;
  }

  return null;
}

/** Everything the description is willing to say about what the flat costs per month. */
export function readDescriptionCosts(description: string | null): DescriptionCosts {
  if (description === null) {
    return { utilitiesPln: null, allIn: false, noFee: false, mentionsUtilities: false };
  }

  const text = toPlainText(description);
  const mentionsUtilities = UTILITY_MENTION.test(text);

  if (ALL_IN_PATTERNS.some((pattern) => pattern.test(text))) {
    return { utilitiesPln: null, allIn: true, noFee: false, mentionsUtilities };
  }

  // "media 600 zl" is the common phrasing, so it gets the first look.
  const utilitiesPln =
    firstUsableAmount(text, AMOUNT_AFTER_WORD) ?? firstUsableAmount(text, AMOUNT_BEFORE_WORD);

  return {
    utilitiesPln,
    allIn: false,
    noFee: NO_FEE_PATTERNS.some((pattern) => pattern.test(text)),
    mentionsUtilities,
  };
}
