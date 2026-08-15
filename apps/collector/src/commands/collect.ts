import { config } from '../config.ts';
import { openDatabase } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { classifyOffers } from './classify.ts';
import { collectOlx } from './collect-olx.ts';
import { collectOtodom } from './collect-otodom.ts';
import { dedupeOffers } from './dedupe.ts';
import { notifyNewOffers } from './notify.ts';

const COLLECTORS = { olx: collectOlx, otodom: collectOtodom } as const;
type SourceName = keyof typeof COLLECTORS;

/**
 * OLX answers 403 from datacenter addresses, so the scheduled cloud round asks for
 * Otodom only and OLX is collected from a machine on a normal connection.
 */
function requestedSources(): SourceName[] {
  // Both names, because the old one is set in an installed systemd unit and in the
  // scheduled workflow. Losing it would quietly widen the cloud round back to OLX, whose
  // every request from a datacenter address is refused.
  const raw = process.env.OVERHEADS_SOURCES ?? process.env.FLATRADAR_SOURCES;
  if (raw === undefined || raw.trim() === '') return ['olx', 'otodom'];

  return raw.split(',').map((name) => {
    const source = name.trim().toLowerCase();
    if (source in COLLECTORS) return source as SourceName;
    throw new Error(`Unknown source "${source}" in OVERHEADS_SOURCES.`);
  });
}

/** One full round: the requested portals, then the verdicts. */
export async function collectAll(): Promise<void> {
  const sql = openDatabase();
  const failures: string[] = [];

  try {
    await migrate(sql);

    for (const name of requestedSources()) {
      try {
        await COLLECTORS[name](sql);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`${name} failed: ${reason}`);
        failures.push(name);
      }
    }

    // Local, so both run even when fetching failed.
    await classifyOffers(sql);
    await dedupeOffers(sql);

    // Last, and after deduplication in particular: the same flat advertised on both
    // portals is one flat, and the owner should hear about it once.
    const credentials = config.telegram();
    if (credentials !== null) {
      try {
        const sent = await notifyNewOffers(sql, credentials);
        if (sent > 0) console.log(`Announced ${sent} listing(s) on Telegram.`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`telegram failed: ${reason}`);
        failures.push('telegram');
      }
    }
  } finally {
    await sql.end();
  }

  // Non-zero exit, so a half-working round is not reported as a success.
  if (failures.length > 0) {
    throw new Error(`Collection failed for: ${failures.join(', ')}.`);
  }
}
