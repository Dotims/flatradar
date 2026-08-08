import { openDatabase } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { classifyOffers } from './classify.ts';
import { collectOlx } from './collect-olx.ts';
import { collectOtodom } from './collect-otodom.ts';

/** One full round: both portals, then the verdicts. */
export async function collectAll(): Promise<void> {
  const sql = openDatabase();
  const failures: string[] = [];

  try {
    await migrate(sql);

    for (const [name, collect] of [
      ['OLX', collectOlx],
      ['Otodom', collectOtodom],
    ] as const) {
      try {
        await collect(sql);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`${name} failed: ${reason}`);
        failures.push(name);
      }
    }

    // Local, so it runs even when fetching failed.
    await classifyOffers(sql);
  } finally {
    await sql.end();
  }

  // Non-zero exit, so a half-working round is not reported as a success.
  if (failures.length > 0) {
    throw new Error(`Collection failed for: ${failures.join(', ')}.`);
  }
}

if (process.argv[1] === import.meta.filename) {
  await collectAll();
}
