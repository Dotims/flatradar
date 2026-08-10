import type { VercelRequest, VercelResponse } from '@vercel/node';
import { syncOtodom } from '../apps/collector/src/api/handlers.ts';
import { openDatabase, type Sql } from '../apps/collector/src/db/client.ts';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Only POST is supported.' });
    return;
  }

  let sql: Sql | null = null;
  try {
    sql = openDatabase();
    response.status(200).json(await syncOtodom(sql));
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: error instanceof Error ? error.message : 'Sync failed.' });
  } finally {
    if (sql !== null) await sql.end();
  }
}
