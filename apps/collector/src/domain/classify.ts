import { readDescriptionCosts } from './cost.ts';
import { isExcludedDistrict } from './districts.ts';
import type { NormalizedOffer } from './offer.ts';

export type Tier = 'top' | 'worth' | 'other';

/**
 * How complete `totalCostPln` is:
 *
 * - `exact`      every part came from the listing
 * - `all_in`     the description says the advertised price covers everything
 * - `estimated`  the building fee was missing and has been assumed
 * - `uncertain`  no rent stated, so there is nothing to add up
 */
export type CostCertainty = 'exact' | 'all_in' | 'estimated' | 'uncertain';

/**
 * Bump this whenever the rules below change. Stored with every verdict, so it is always
 * possible to tell which listings were judged under the old criteria and recompute them.
 */
export const RULES_VERSION = 2;

/** Advertised rent alone, ignoring everything on top. */
const WORTH_MAX_RENT_PLN = 2200;
/** Rent plus building fee plus utilities: what actually leaves the account each month. */
const TOP_MAX_TOTAL_PLN = 2600;

/**
 * What to assume when a listing gives no building fee. Roughly what a Kraków flat costs
 * in administration and metered utilities, so a silent listing is judged on a realistic
 * figure instead of being parked in a tier nobody reads. It is an assumption, and every
 * verdict that leans on it says so.
 */
const ASSUMED_FEE_PLN = 400;

export interface Classification {
  tier: Tier;
  /**
   * Rent plus building fee plus stated utilities, in whole PLN. Null only when the
   * listing states no rent at all. Read it together with `costCertainty`.
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
  const stated = readDescriptionCosts(offer.description);
  const reasons: string[] = [];

  if (offer.pricePln === null) {
    return {
      tier: 'other',
      totalCostPln: null,
      costCertainty: 'uncertain',
      reasons: ['The listing states no rent.'],
    };
  }

  let fee: number;
  let costCertainty: CostCertainty;

  if (stated.allIn) {
    fee = offer.rentPln ?? 0;
    costCertainty = 'all_in';
    reasons.push('The description says the price covers everything.');
  } else if (offer.rentPln !== null) {
    fee = offer.rentPln;
    costCertainty = 'exact';
    reasons.push(`The building fee is stated as ${fee} PLN.`);
  } else if (stated.noFee) {
    fee = 0;
    costCertainty = 'exact';
    reasons.push('The description says there is no building fee.');
  } else {
    fee = ASSUMED_FEE_PLN;
    costCertainty = 'estimated';
    reasons.push(`No building fee is given, so ${ASSUMED_FEE_PLN} PLN is assumed.`);
  }

  const totalCostPln = offer.pricePln + fee + (stated.utilitiesPln ?? 0);

  if (stated.utilitiesPln !== null) {
    reasons.push(`The description states utilities of ${stated.utilitiesPln} PLN.`);
  } else if (stated.mentionsUtilities && !stated.allIn) {
    // Worth saying out loud: the total is a floor, and the flat may cost more.
    reasons.push('Utilities are mentioned without an amount and are not included above.');
  }

  // The area rule comes first and is absolute: a cheap flat in the wrong district is
  // still the wrong district.
  if (isExcludedDistrict(offer.district)) {
    reasons.push(`${offer.district} is an excluded district.`);
    return { tier: 'other', totalCostPln, costCertainty, reasons };
  }

  if (totalCostPln <= TOP_MAX_TOTAL_PLN) {
    reasons.push(`Total ${totalCostPln} PLN is within the ${TOP_MAX_TOTAL_PLN} PLN limit.`);
    return { tier: 'top', totalCostPln, costCertainty, reasons };
  }

  if (offer.pricePln <= WORTH_MAX_RENT_PLN) {
    reasons.push(`Rent ${offer.pricePln} PLN is within the ${WORTH_MAX_RENT_PLN} PLN limit.`);
    return { tier: 'worth', totalCostPln, costCertainty, reasons };
  }

  reasons.push(`Rent ${offer.pricePln} PLN exceeds the ${WORTH_MAX_RENT_PLN} PLN limit.`);
  return { tier: 'other', totalCostPln, costCertainty, reasons };
}
