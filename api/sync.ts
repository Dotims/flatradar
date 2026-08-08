import { syncOtodom } from '../apps/collector/src/api/handlers.ts';
import { openDatabase } from '../apps/collector/src/db/client.ts';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Only POST is supported.' }, { status: 405 });
  }

  const sql = openDatabase();
  try {
    return Response.json(await syncOtodom(sql));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Sync failed.' },
      { status: 500 },
    );
  } finally {
    await sql.end();
  }
}
