import { collectOlx } from './collect-olx.ts';
import { collectOtodom } from './collect-otodom.ts';
import { classifyOffers } from './classify.ts';

/**
 * One full round: both portals, then the verdicts. This is what the timer runs.
 *
 * A portal failing must not take the round down with it. OLX and Otodom break in
 * unrelated ways - an expired build id on one side says nothing about the other - and a
 * round that collected half the market and judged it is worth far more than no round at
 * all. Each failure is recorded in `fetch_runs` by the collector that hit it, so a portal
 * that has been failing quietly for days is visible rather than merely absent.
 */
export async function collectAll(): Promise<void> {
  const failures: string[] = [];

  for (const [name, collect] of [
    ['OLX', collectOlx],
    ['Otodom', collectOtodom],
  ] as const) {
    try {
      await collect();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`${name} failed: ${reason}`);
      failures.push(name);
    }
  }

  // Runs regardless: classification is local, and listings collected earlier still
  // deserve a verdict even when today's fetch went badly.
  classifyOffers();

  if (failures.length > 0) {
    // A non-zero exit makes systemd mark the unit failed, so `systemctl --user status`
    // shows the problem instead of a run that looks fine.
    throw new Error(`Collection failed for: ${failures.join(', ')}.`);
  }
}

if (process.argv[1] === import.meta.filename) {
  await collectAll();
}
