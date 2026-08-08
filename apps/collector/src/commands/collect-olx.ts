import { migrate } from '../db/migrate.ts';
import { openDatabase } from '../db/open.ts';
import { upsertOffer } from '../db/offers.ts';
import { finishRun, startRun } from '../db/runs.ts';
import { fetchOlxOffers } from '../sources/olx/client.ts';
import { parseOlxOffer } from '../sources/olx/parse.ts';

export async function collectOlx(pages = 2): Promise<void> {
  const db = openDatabase();
  migrate(db);

  const runId = startRun(db, 'olx');
  let seen = 0;
  let added = 0;
  let repriced = 0;

  try {
    const offers = await fetchOlxOffers({ pages });
    seen = offers.length;

    // One transaction: lands whole or not at all, and far faster than row by row.
    db.exec('begin');
    try {
      for (const raw of offers) {
        const result = upsertOffer(db, parseOlxOffer(raw));
        if (result.isNew) added++;
        if (result.priceChanged) repriced++;
      }
      db.exec('commit');
    } catch (error) {
      db.exec('rollback');
      throw error;
    }

    finishRun(db, runId, { itemsSeen: seen, itemsNew: added });
    console.log(`OLX: fetched ${seen}, new ${added}, price changed ${repriced}.`);
  } catch (error) {
    finishRun(db, runId, {
      itemsSeen: seen,
      itemsNew: added,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    db.close();
  }
}

if (process.argv[1] === import.meta.filename) {
  const pages = Number(process.argv[2] ?? 2);
  await collectOlx(Number.isFinite(pages) ? pages : 2);
}
