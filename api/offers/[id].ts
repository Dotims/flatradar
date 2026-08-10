import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readDetail } from '../../apps/collector/src/api/handlers.ts';
import { openDatabase } from '../../apps/collector/src/db/client.ts';

/** The path segment is a string from the URL until it is proven to be a row id. */
function readId(raw: VercelRequest['query'][string]): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || !/^\d+$/.test(value)) return null;
  return Number(value);
}

/**
 * One listing in full. The list endpoint next door stays light because the description
 * and photos live only here.
 *
 * Read-only: favourites and rejections are kept in each visitor's own browser, so this
 * page can be shared without handing strangers a write endpoint.
 */
export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  const id = readId(request.query['id']);
  if (id === null) {
    response.status(400).json({ error: 'Nieprawidłowy identyfikator oferty.' });
    return;
  }

  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Only GET is supported.' });
    return;
  }

  const sql = openDatabase();
  try {
    response.setHeader('Cache-Control', 'no-store');

    const found = await readDetail(sql, id);
    if (found === null) response.status(404).json({ error: 'Nie ma takiej oferty.' });
    else response.status(200).json(found);
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: error instanceof Error ? error.message : 'Query failed.' });
  } finally {
    await sql.end();
  }
}
