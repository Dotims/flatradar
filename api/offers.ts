import { readOffers } from '../apps/collector/src/api/handlers.ts';
import { openDatabase } from '../apps/collector/src/db/client.ts';

export default async function handler(): Promise<Response> {
  const sql = openDatabase();
  try {
    return Response.json(await readOffers(sql), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } finally {
    await sql.end();
  }
}
