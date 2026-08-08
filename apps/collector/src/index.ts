import { openDatabase } from './db/client.ts';
import { migrate } from './db/migrate.ts';
import { readNullableIso, readNumber, readString, type DbRow } from './db/rows.ts';

/** Prints what is in the database. */
async function main(): Promise<void> {
  const sql = openDatabase();

  try {
    await migrate(sql);

    const bySource = await sql<DbRow[]>`
      select source, count(*) as total from offers group by source order by source
    `;
    const byTier = await sql<DbRow[]>`
      select tier, count(*) as total from classifications group by tier order by tier
    `;
    const runs = await sql<DbRow[]>`
      select source, max(started_at) as last_run from fetch_runs group by source order by source
    `;

    console.log(`Offers:  ${bySource.reduce((sum, row) => sum + readNumber(row, 'total'), 0)}`);
    for (const row of bySource) {
      console.log(`  ${readString(row, 'source').padEnd(8)} ${readNumber(row, 'total')}`);
    }

    for (const row of byTier) {
      console.log(`  ${readString(row, 'tier').padEnd(8)} ${readNumber(row, 'total')}`);
    }

    if (runs.length === 0) {
      console.log('Fetch runs: none, no collector has run yet.');
    } else {
      for (const row of runs) {
        console.log(
          `  ${readString(row, 'source').padEnd(8)} last run ${readNullableIso(row, 'last_run')}`,
        );
      }
    }
  } finally {
    await sql.end();
  }
}

await main();
