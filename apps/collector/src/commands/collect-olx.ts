import type { Sql } from '../db/client.ts';
import { upsertOffer } from '../db/offers.ts';
import { finishRun, startRun } from '../db/runs.ts';
import { fetchOlxOffers } from '../sources/olx/client.ts';
import { parseOlxOffer } from '../sources/olx/parse.ts';

export async function collectOlx(sql: Sql, pages = 2): Promise<void> {
  const runId = await startRun(sql, 'olx');
  let seen = 0;
  let added = 0;
  let repriced = 0;

  try {
    const offers = await fetchOlxOffers({ pages });
    seen = offers.length;

    // One transaction: lands whole or not at all, and far faster than row by row.
    await sql.begin(async (tx) => {
      for (const raw of offers) {
        const result = await upsertOffer(tx, parseOlxOffer(raw));
        if (result.isNew) added++;
        if (result.priceChanged) repriced++;
      }
    });

    await finishRun(sql, runId, { itemsSeen: seen, itemsNew: added });
    console.log(`OLX: fetched ${seen}, new ${added}, price changed ${repriced}.`);
  } catch (error) {
    await finishRun(sql, runId, {
      itemsSeen: seen,
      itemsNew: added,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
