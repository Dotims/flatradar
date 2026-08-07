import { migrate } from './db/migrate.ts';
import { openDatabase } from './db/open.ts';
import { config } from './config.ts';

/**
 * Prints what is in the database. Nothing is fetched yet at this stage, so the only
 * useful thing to confirm is that the schema comes up and can be read back.
 */
function main(): void {
  const db = openDatabase();
  migrate(db);

  const offersBySource = db
    .prepare('select source, count(*) as total from offers group by source order by source')
    .all();

  const lastRuns = db
    .prepare(
      `select source, max(started_at) as last_run, sum(items_new) as new_total
       from fetch_runs group by source order by source`,
    )
    .all();

  const total = db.prepare('select count(*) as total from offers').get();

  console.log(`Database: ${config.databasePath}`);
  console.log(`Offers:   ${Number(total?.total ?? 0)}`);

  for (const row of offersBySource) {
    console.log(`  ${String(row.source).padEnd(8)} ${Number(row.total)}`);
  }

  if (lastRuns.length === 0) {
    console.log('Fetch runs: none, no collector has run yet.');
  } else {
    for (const row of lastRuns) {
      console.log(`  ${String(row.source).padEnd(8)} last run ${String(row.last_run)}`);
    }
  }

  db.close();
}

main();
