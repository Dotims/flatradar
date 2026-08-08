import { saveClassification } from '../db/classifications.ts';
import { migrate } from '../db/migrate.ts';
import { listOffersToClassify } from '../db/offers.ts';
import { openDatabase } from '../db/open.ts';
import { classify, RULES_VERSION, type Tier } from '../domain/classify.ts';

/** Judges every listing without a current verdict. Local: touches no portal. */
export function classifyOffers(): Record<Tier, number> {
  const db = openDatabase();
  migrate(db);

  const counts: Record<Tier, number> = { top: 0, worth: 0, other: 0 };

  try {
    const pending = listOffersToClassify(db, RULES_VERSION);

    db.exec('begin');
    try {
      for (const offer of pending) {
        const verdict = classify(offer);
        saveClassification(db, offer.id, verdict, RULES_VERSION);
        counts[verdict.tier]++;
      }
      db.exec('commit');
    } catch (error) {
      db.exec('rollback');
      throw error;
    }

    console.log(
      `Classified ${pending.length} offers under rules v${RULES_VERSION}: ` +
        `${counts.top} top, ${counts.worth} worth, ${counts.other} other.`,
    );
  } finally {
    db.close();
  }

  return counts;
}

if (process.argv[1] === import.meta.filename) {
  classifyOffers();
}
