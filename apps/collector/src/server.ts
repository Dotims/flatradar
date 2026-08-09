import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  assertIngestAllowed,
  ingestOlx,
  readDetail,
  readMark,
  readOffers,
  syncOtodom,
  writeMark,
} from './api/handlers.ts';
import { openDatabase } from './db/client.ts';
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

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return null;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function startServer(port: number = PORT): Promise<ReturnType<typeof createServer>> {
  const sql = openDatabase();
  await migrate(sql);

  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', `http://${HOST}:${port}`);

    void (async () => {
      try {
        if (request.method === 'GET' && url.pathname === '/api/offers') {
          sendJson(response, 200, await readOffers(sql));
          return;
        }
        // Same path in both servers: Vercel routes one file per path, so the mark shares
        // the listing's own endpoint rather than needing a segment of its own.
        const one = /^\/api\/offers\/(\d+)$/.exec(url.pathname);
        if (one?.[1] !== undefined && request.method === 'GET') {
          const found = await readDetail(sql, Number(one[1]));
          if (found === null) sendJson(response, 404, { error: 'Nie ma takiej oferty.' });
          else sendJson(response, 200, found);
          return;
        }
        if (one?.[1] !== undefined && request.method === 'POST') {
          // A body we do not understand is the caller's mistake, not ours.
          let mark;
          try {
            mark = readMark(await readBody(request));
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : 'Bad request.',
            });
            return;
          }

          await writeMark(sql, Number(one[1]), mark);
          sendJson(response, 200, { ok: true });
          return;
        }
        if (request.method === 'GET' && url.pathname === '/api/health') {
          sendJson(response, 200, { ok: true });
          return;
        }
        if (request.method === 'POST' && url.pathname === '/api/sync') {
          sendJson(response, 200, await syncOtodom(sql));
          return;
        }
        if (request.method === 'POST' && url.pathname === '/api/ingest/olx') {
          assertIngestAllowed((request.headers['x-flatradar-token'] as string | undefined) ?? null);
          sendJson(response, 200, await ingestOlx(sql, await readBody(request)));
          return;
        }
        sendJson(response, 404, { error: `Nothing at ${url.pathname}.` });
      } catch (error) {
        // Detail stays in the terminal, not in the browser.
        console.error(error);
        sendJson(response, 500, {
          error: error instanceof Error ? error.message : 'The request failed.',
        });
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
