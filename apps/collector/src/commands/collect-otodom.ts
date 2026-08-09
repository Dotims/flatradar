import { openDatabase, type Sql } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { listDetailedSourceIds, upsertOffer } from '../db/offers.ts';
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

export interface CollectOtodomOptions {
  pages?: number;
  maxDetails?: number;
}

export async function collectOtodom(
  sql: Sql,
  { pages = 2, maxDetails = MAX_DETAILS_PER_RUN }: CollectOtodomOptions = {},
): Promise<void> {
  const runId = await startRun(sql, 'otodom');
  let seen = 0;
  let added = 0;
  let repriced = 0;
  let detailed = 0;
  let skipped = 0;
  let unreadable = 0;

  try {
    const alreadyDetailed = await listDetailedSourceIds(sql, 'otodom');
    const items = await fetchOtodomList({
      pages,
      onPage: (page, totalPages, count) =>
        console.log(`Otodom: page ${page}/${totalPages}, ${count} listings.`),
    });
    seen = items.length;

    // Descriptions and coordinates cost a request each, so only survivors get one.
    // Whoever misses out is written back without touching the detail already stored.
    const offers: { offer: NormalizedOffer; preserveDetail: boolean }[] = [];

    for (const item of items) {
      const withoutDetail = parseOtodomOffer(item);

      if (alreadyDetailed.has(withoutDetail.sourceId)) {
        skipped++;
        offers.push({ offer: withoutDetail, preserveDetail: true });
        continue;
      }

      if (!mightQualify(withoutDetail) || detailed >= maxDetails) {
        offers.push({ offer: withoutDetail, preserveDetail: true });
        continue;
      }

      if (detailed > 0) await sleep(DETAIL_DELAY_MS);
      detailed++;

      // One withdrawn or renamed listing must not cost the run every other listing in
      // it: the writes only happen once the loop is over.
      try {
        const ad = await fetchOtodomAd(item.slug);
        offers.push(
          ad === undefined
            ? { offer: withoutDetail, preserveDetail: true }
            : { offer: parseOtodomOffer(item, ad), preserveDetail: false },
        );
      } catch (error) {
        unreadable++;
        if (unreadable <= 3) {
          console.warn(`Otodom: ${item.slug} unreadable (${String(error)}).`);
        }
        offers.push({ offer: withoutDetail, preserveDetail: true });
      }
    }

    await sql.begin(async (tx) => {
      for (const { offer, preserveDetail } of offers) {
        const result = await upsertOffer(tx, offer, { preserveDetail });
        if (result.isNew) added++;
        if (result.priceChanged) repriced++;
      }
    });

    await finishRun(sql, runId, { itemsSeen: seen, itemsNew: added });
    console.log(
      `Otodom: fetched ${seen}, detailed ${detailed}, skipped ${skipped}, unreadable ${unreadable}, new ${added}, price changed ${repriced}.`,
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
    await collectOtodom(sql, {
      pages: Number(process.argv[2] ?? 2) || 2,
      maxDetails: Number(process.argv[3] ?? MAX_DETAILS_PER_RUN) || MAX_DETAILS_PER_RUN,
    });
  } finally {
    await sql.end();
  }
}
