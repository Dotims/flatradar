import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { openDatabase } from './db/client.ts';
import { listClassifiedOffers } from './db/classifications.ts';
import { migrate } from './db/migrate.ts';

const PORT = Number(process.env.FLATRADAR_PORT ?? 4317);
/** Loopback only: binding wider would put scraped listings on the network by accident. */
const HOST = '127.0.0.1';

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  response.end(payload);
}

export async function startServer(port: number = PORT): Promise<ReturnType<typeof createServer>> {
  const sql = openDatabase();
  await migrate(sql);

  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', `http://${HOST}:${port}`);

    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Only GET is supported.' });
      return;
    }

    void (async () => {
      try {
        switch (url.pathname) {
          case '/api/offers':
            sendJson(response, 200, { offers: await listClassifiedOffers(sql) });
            return;
          case '/api/health':
            sendJson(response, 200, { ok: true });
            return;
          default:
            sendJson(response, 404, { error: `Nothing at ${url.pathname}.` });
            return;
        }
      } catch (error) {
        // Detail stays in the terminal, not in the browser.
        console.error(error);
        sendJson(response, 500, { error: 'The query failed. See the collector output.' });
      }
    })();
  });

  server.listen(port, HOST, () => {
    console.log(`FlatRadar API on http://${HOST}:${port}/api/offers`);
  });

  server.on('close', () => void sql.end());

  return server;
}

if (process.argv[1] === import.meta.filename) {
  await startServer();
}
