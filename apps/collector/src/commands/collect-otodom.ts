import { openDatabase, type Sql } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { upsertOffer } from '../db/offers.ts';
import { finishRun, startRun } from '../db/runs.ts';
import { mightQualify } from '../domain/classify.ts';
import type { NormalizedOffer } from '../domain/offer.ts';
import { sleep } from '../sources/http.ts';
import { fetchOtodomAd, fetchOtodomList } from '../sources/otodom/client.ts';
import { parseOtodomOffer } from '../sources/otodom/parse.ts';

/** Between listing page requests. */
const DETAIL_DELAY_MS = 1_000;

/** So a bad filter cannot turn one poll into hundreds of requests. */
const MAX_DETAILS_PER_RUN = 25;

export async function collectOtodom(sql: Sql, pages = 2): Promise<void> {
  const runId = await startRun(sql, 'otodom');
  let seen = 0;
  let added = 0;
  let repriced = 0;
  let detailed = 0;

  try {
    const items = await fetchOtodomList({ pages });
    seen = items.length;

    // Descriptions and coordinates cost a request each, so only survivors get one.
    const offers: NormalizedOffer[] = [];

    for (const item of items) {
      const withoutDetail = parseOtodomOffer(item);

      if (!mightQualify(withoutDetail) || detailed >= MAX_DETAILS_PER_RUN) {
        offers.push(withoutDetail);
        continue;
      }

      if (detailed > 0) await sleep(DETAIL_DELAY_MS);
      const ad = await fetchOtodomAd(item.slug);
      detailed++;
      offers.push(ad === undefined ? withoutDetail : parseOtodomOffer(item, ad));
    }

    await sql.begin(async (tx) => {
      for (const offer of offers) {
        const result = await upsertOffer(tx, offer);
        if (result.isNew) added++;
        if (result.priceChanged) repriced++;
      }
    });

    await finishRun(sql, runId, { itemsSeen: seen, itemsNew: added });
    console.log(
      `Otodom: fetched ${seen}, detailed ${detailed}, new ${added}, price changed ${repriced}.`,
    );
  } catch (error) {
    await finishRun(sql, runId, {
      itemsSeen: seen,
      itemsNew: added,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

if (process.argv[1] === import.meta.filename) {
  const sql = openDatabase();
  try {
    await migrate(sql);
    await collectOtodom(sql, Number(process.argv[2] ?? 2) || 2);
  } finally {
    await sql.end();
  }
}
