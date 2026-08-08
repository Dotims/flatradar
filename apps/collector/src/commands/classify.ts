import { openDatabase } from '../db/client.ts';
import { saveClassification } from '../db/classifications.ts';
import { migrate } from '../db/migrate.ts';
import { listOffersToClassify } from '../db/offers.ts';
import type { Sql } from '../db/client.ts';
import { classify, RULES_VERSION, type Tier } from '../domain/classify.ts';

/** Judges every listing without a current verdict. Local: touches no portal. */
export async function classifyOffers(sql: Sql): Promise<Record<Tier, number>> {
  const counts: Record<Tier, number> = { top: 0, worth: 0, other: 0 };
  const pending = await listOffersToClassify(sql, RULES_VERSION);

  await sql.begin(async (tx) => {
    for (const offer of pending) {
      const verdict = classify(offer);
      await saveClassification(tx, offer.id, verdict, RULES_VERSION);
      counts[verdict.tier]++;
    }
  });

  console.log(
    `Classified ${pending.length} offers under rules v${RULES_VERSION}: ` +
      `${counts.top} top, ${counts.worth} worth, ${counts.other} other.`,
  );

  return counts;
}

if (process.argv[1] === import.meta.filename) {
  const sql = openDatabase();
  try {
    await migrate(sql);
    await classifyOffers(sql);
  } finally {
    await sql.end();
  }
}
