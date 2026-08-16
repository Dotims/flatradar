import type { Sql } from '../db/client.ts';
import { upsertOffer } from '../db/offers.ts';
import { finishRun, startRun } from '../db/runs.ts';
import { fetchGratkaOffers } from '../sources/gratka/client.ts';
import { parseGratkaOffer } from '../sources/gratka/parse.ts';

/**
 * The third portal. Measured against 105 of its listings before it was added: half were
 * already here from the other two, which is what dedupe is for, and the rest brought
 * about six flats a day that nothing else was showing.
 */
export async function collectGratka(sql: Sql, pages = 2): Promise<void> {
  const runId = await startRun(sql, 'gratka');
  let seen = 0;
  let added = 0;
  let repriced = 0;

  try {
    const offers = await fetchGratkaOffers({ pages });
    seen = offers.length;

    // One transaction: lands whole or not at all, and far faster than row by row.
    await sql.begin(async (tx) => {
      for (const raw of offers) {
        const result = await upsertOffer(tx, parseGratkaOffer(raw));
        if (result.isNew) added++;
        if (result.priceChanged) repriced++;
      }
    });

    await finishRun(sql, runId, { itemsSeen: seen, itemsNew: added });
    console.log(`Gratka: fetched ${seen}, new ${added}, price changed ${repriced}.`);
  } catch (error) {
    await finishRun(sql, runId, {
      itemsSeen: seen,
      itemsNew: added,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
