import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { listClassifiedOffers } from './db/classifications.ts';
import { migrate } from './db/migrate.ts';
import { openDatabase } from './db/open.ts';

const PORT = Number(process.env.FLATRADAR_PORT ?? 4317);
/** Loopback only. This serves a personal flat search off a local database; it is not
 * meant to be reachable from anywhere else, and binding to all interfaces would put
 * scraped listings on the network by accident. */
const HOST = '127.0.0.1';

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    // The dashboard should never show a stale price.
    'Cache-Control': 'no-store',
  });
  response.end(payload);
}

export function startServer(port: number = PORT): ReturnType<typeof createServer> {
  const db = openDatabase();
  migrate(db);

  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', `http://${HOST}:${port}`);

    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Only GET is supported.' });
      return;
    }

    try {
      switch (url.pathname) {
        case '/api/offers':
          sendJson(response, 200, { offers: listClassifiedOffers(db) });
          return;
        case '/api/health':
          sendJson(response, 200, { ok: true });
          return;
        default:
          sendJson(response, 404, { error: `Nothing at ${url.pathname}.` });
          return;
      }
    } catch (error) {
      // The browser gets a flat message; the detail stays in the terminal where the
      // owner can see it.
      console.error(error);
      sendJson(response, 500, { error: 'The query failed. See the collector output.' });
    }
  });

  server.listen(port, HOST, () => {
    console.log(`FlatRadar API on http://${HOST}:${port}/api/offers`);
  });

  server.on('close', () => db.close());

  return server;
}

if (process.argv[1] === import.meta.filename) {
  startServer();
}
