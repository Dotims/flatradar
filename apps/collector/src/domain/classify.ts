import { isExcludedDistrict } from './districts.ts';
import { readUtilityCost, type CostCertainty } from './cost.ts';
import type { NormalizedOffer } from './offer.ts';

export type Tier = 'top' | 'worth' | 'other';

/**
 * Bump this whenever the rules below change. Stored with every verdict, so it is always
 * possible to tell which listings were judged under the old criteria and recompute them.
 */
export const RULES_VERSION = 1;

/** Advertised rent alone, ignoring everything on top. */
const WORTH_MAX_RENT_PLN = 2200;
/** Rent plus building fee plus utilities: what actually leaves the account each month. */
const TOP_MAX_TOTAL_PLN = 2600;

export interface Classification {
  tier: Tier;
  /**
   * Rent plus building fee plus whatever utilities the description stated, in whole PLN.
   * How complete this figure is depends on `costCertainty`: under `uncertain` it is a
   * floor, not a total. Null only when the listing states no rent at all.
   */
  totalCostPln: number | null;
  costCertainty: CostCertainty;
  reasons: string[];
}

/**
 * Turns one listing into a verdict. Pure on purpose: no database, no network, no clock.
 * Every input is on the offer, so the whole thing is testable by handing it an object,
 * and rerunning it over stored rows costs nothing.
 */
export function classify(offer: NormalizedOffer): Classification {
  const utilities = readUtilityCost(offer.description);
  const reasons: string[] = [];

  if (offer.pricePln === null) {
    return {
      tier: 'other',
      totalCostPln: null,
      costCertainty: utilities.certainty,
      reasons: ['The listing states no rent.'],
    };
  }

  const fee = offer.rentPln ?? 0;
  const totalCostPln = offer.pricePln + fee + (utilities.amountPln ?? 0);

  switch (utilities.certainty) {
    case 'all_in':
      reasons.push('The description says the price covers everything.');
      break;
    case 'exact':
      reasons.push(`The description states utilities of ${utilities.amountPln} PLN.`);
      break;
    case 'uncertain':
      reasons.push(
        utilities.mentioned
          ? 'Utilities are mentioned without an amount, so the total is a lower bound.'
          : 'The description says nothing about utilities, so the total is a lower bound.',
      );
      break;
  }

  // The area rule comes first and is absolute: a cheap flat in the wrong district is
  // still the wrong district.
  if (isExcludedDistrict(offer.district)) {
    reasons.push(`${offer.district} is an excluded district.`);
    return { tier: 'other', totalCostPln, costCertainty: utilities.certainty, reasons };
  }

  // Priority tier. An uncertain total cannot qualify: promoting a listing here on a
  // guess about utilities costs a viewing, while leaving it in `worth` costs nothing.
  if (utilities.certainty !== 'uncertain' && totalCostPln <= TOP_MAX_TOTAL_PLN) {
    reasons.push(`Total ${totalCostPln} PLN is within the ${TOP_MAX_TOTAL_PLN} PLN limit.`);
    return { tier: 'top', totalCostPln, costCertainty: utilities.certainty, reasons };
  }

  if (offer.pricePln <= WORTH_MAX_RENT_PLN) {
    reasons.push(`Rent ${offer.pricePln} PLN is within the ${WORTH_MAX_RENT_PLN} PLN limit.`);
    return { tier: 'worth', totalCostPln, costCertainty: utilities.certainty, reasons };
  }

  reasons.push(`Rent ${offer.pricePln} PLN exceeds the ${WORTH_MAX_RENT_PLN} PLN limit.`);
  return { tier: 'other', totalCostPln, costCertainty: utilities.certainty, reasons };
}
