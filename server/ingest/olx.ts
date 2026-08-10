import type { VercelRequest, VercelResponse } from '@vercel/node';
import { assertIngestAllowed, ingestOlx } from '../../apps/collector/src/api/handlers.ts';
import { openDatabase, type Sql } from '../../apps/collector/src/db/client.ts';

/** OLX will not answer this server, so a device on an ordinary connection posts here. */
export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Only POST is supported.' });
    return;
  }

  try {
    const presented = request.headers['x-flatradar-token'];
    assertIngestAllowed(typeof presented === 'string' ? presented : null);
  } catch (error) {
    response.status(401).json({ error: error instanceof Error ? error.message : 'Refused.' });
    return;
  }

  let sql: Sql | null = null;
  try {
    sql = openDatabase();
    response.status(200).json(await ingestOlx(sql, request.body));
  } catch (error) {
    console.error(error);
    response.status(400).json({ error: error instanceof Error ? error.message : 'Ingest failed.' });
  } finally {
    if (sql !== null) await sql.end();
  }
}
