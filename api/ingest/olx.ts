import { assertIngestAllowed, ingestOlx } from '../../apps/collector/src/api/handlers.ts';
import { openDatabase } from '../../apps/collector/src/db/client.ts';

/** OLX will not answer this server, so a device on an ordinary connection posts here. */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Only POST is supported.' }, { status: 405 });
  }

  try {
    assertIngestAllowed(request.headers.get('x-flatradar-token'));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Refused.' },
      { status: 401 },
    );
  }

  const sql = openDatabase();
  try {
    return Response.json(await ingestOlx(sql, await request.json()));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Ingest failed.' },
      { status: 400 },
    );
  } finally {
    await sql.end();
  }
}
