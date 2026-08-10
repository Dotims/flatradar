import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readOffers } from '../apps/collector/src/api/handlers.ts';
import { openDatabase, type Sql } from '../apps/collector/src/db/client.ts';

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  let sql: Sql | null = null;
  try {
    sql = openDatabase();
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).json(await readOffers(sql));
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: error instanceof Error ? error.message : 'Query failed.' });
  } finally {
    if (sql !== null) await sql.end();
  }
}
