import type { DatabaseSync } from 'node:sqlite';
import type { Classification } from '../domain/classify.ts';

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
