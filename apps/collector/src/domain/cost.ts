/**
 * Reading utility costs out of the listing description.
 *
 * Both portals give the rent and the building fee as structured numbers, but utilities
 * are prose, written by whoever placed the ad: "media 600 zl", "prąd: około 150 zł",
 * "prąd według zużycia", "już ze wszystkim". This module says only what the description
 * actually states, and admits ignorance otherwise. It never estimates a missing amount.
 */

export type CostCertainty = 'exact' | 'all_in' | 'uncertain';

export interface UtilityReading {
  /** Utilities stated on top of rent and building fee, in whole PLN. */
  amountPln: number | null;
  certainty: CostCertainty;
  /**
   * Whether the description talks about utilities at all. It does not change the
   * verdict, but "says nothing about media" and "says media are metered without giving
   * a figure" are different situations to look at, so the reason line keeps them apart.
   */
  mentioned: boolean;
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
 */
/**
 * "najem" is deliberately absent. It reads like an obvious thing to block, but it
 * blocked "cena najmu 2700 zł + ok. 850 zł opłat dodatkowych", which states the extras
 * perfectly clearly. The rent itself is already kept out by the upper bound below: no
 * rent in Kraków lands under 1500 PLN.
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

/**
 * Certainty, in the order the checks matter:
 *
 * - `all_in`     the description claims everything is covered
 * - `exact`      it names a utility amount we can add up
 * - `uncertain`  everything else, including saying nothing at all
 *
 * Silence is treated as uncertainty rather than as zero. Most Kraków listings do carry
 * utilities on top, so reading a missing sentence as "nothing extra" would promote
 * unaffordable flats into the priority tier, which is the expensive direction to be
 * wrong in: it costs a viewing. Being wrong the other way only leaves the listing in
 * the lower tier, where it is still visible.
 */
export function readUtilityCost(description: string | null): UtilityReading {
  if (description === null) {
    return { amountPln: null, certainty: 'uncertain', mentioned: false };
  }

  const text = toPlainText(description);
  const mentioned = UTILITY_MENTION.test(text);

  if (ALL_IN_PATTERNS.some((pattern) => pattern.test(text))) {
    return { amountPln: null, certainty: 'all_in', mentioned };
  }

  // "media 600 zl" is the common phrasing, so it gets the first look.
  const amount =
    firstUsableAmount(text, AMOUNT_AFTER_WORD) ?? firstUsableAmount(text, AMOUNT_BEFORE_WORD);
  if (amount !== null) {
    return { amountPln: amount, certainty: 'exact', mentioned };
  }

  return { amountPln: null, certainty: 'uncertain', mentioned };
}
