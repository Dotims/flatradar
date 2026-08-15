import { connect, constants, type IncomingHttpHeaders } from 'node:http2';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';

/**
 * A GET over HTTP/2, using Node's built-in client.
 *
 * This exists because on 2026-08-15 OLX stopped answering HTTP/1.1 on `/api/v1/offers/`:
 * its CloudFront edge returns 403 with an HTML error page, while the same URL, the same
 * headers and the same address get a 200 over HTTP/2. Node's `fetch` speaks HTTP/1.1
 * only, so every collection round from 19:27 that evening failed. Measured, not guessed:
 * `curl --http1.1` answered 403 and `curl --http2` answered 200, seconds apart.
 *
 * This is not an attempt to look like a browser. The User-Agent and the honest headers
 * are unchanged; the only thing that moves is which version of the protocol carries them,
 * and the newer one is what the portal now serves.
 */

/** Where fetch left off: the body is text, and the callers parse it. */
export interface Http2Reply {
  status: number;
  body: string;
  /** Absolute, already resolved against the URL that sent it. Null unless a redirect. */
  location: URL | null;
}

/** A portal that answers a redirect with another redirect four times is broken, not slow. */
const MAX_REDIRECTS = 3;

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/**
 * HTTP/2 forbids capitalised header names and Node rejects them rather than quietly
 * fixing them. The callers were written against fetch, which is case-insensitive.
 */
function lowercased(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
}

/**
 * fetch asked for compression and unpacked it without being told. Doing neither would put
 * whole search pages on the wire uncompressed, which is rude to a service that is not
 * ours, so we ask and unpack here instead.
 */
function decode(body: Buffer, encoding: string | undefined): string {
  if (encoding === 'gzip') return gunzipSync(body).toString('utf8');
  if (encoding === 'br') return brotliDecompressSync(body).toString('utf8');
  if (encoding === 'deflate') return inflateSync(body).toString('utf8');
  return body.toString('utf8');
}

function readStatus(headers: IncomingHttpHeaders): number {
  const status = headers[constants.HTTP2_HEADER_STATUS];
  if (typeof status !== 'number') throw new Error('The HTTP/2 response carried no status.');
  return status;
}

function readLocation(status: number, headers: IncomingHttpHeaders, from: URL): URL | null {
  const location = headers['location'];
  if (!REDIRECTS.has(status) || typeof location !== 'string') return null;
  return new URL(location, from);
}

/** One exchange: connect, ask, read, hang up. */
async function once(
  url: URL,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<Http2Reply> {
  const session = connect(url.origin);

  try {
    return await new Promise<Http2Reply>((resolve, reject) => {
      session.on('error', reject);

      const request = session.request({
        [constants.HTTP2_HEADER_METHOD]: 'GET',
        [constants.HTTP2_HEADER_PATH]: `${url.pathname}${url.search}`,
        'accept-encoding': 'gzip, br',
        ...lowercased(headers),
      });

      // One timer over the whole exchange, matching the single AbortSignal.timeout that
      // fetch was given. A response that starts and then stalls is still a timeout.
      const timer = setTimeout(() => {
        request.destroy(new Error(`Timed out after ${timeoutMs}ms for ${url.href}`));
      }, timeoutMs);

      let received: IncomingHttpHeaders = {};
      const chunks: Buffer[] = [];

      request.on('response', (responseHeaders) => {
        received = responseHeaders;
      });
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      request.on('end', () => {
        clearTimeout(timer);
        try {
          const status = readStatus(received);
          resolve({
            status,
            body: decode(Buffer.concat(chunks), received['content-encoding']),
            location: readLocation(status, received, url),
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  } finally {
    // A session per request, deliberately. The collector makes a handful of calls with a
    // pause between them, so pooling would save one handshake and cost us a connection
    // that goes stale between rounds.
    session.close();
  }
}

/**
 * The request, following redirects the way fetch did.
 *
 * The callers were written expecting that. Neither portal redirects these URLs today, but
 * a path that moves would otherwise arrive as a bare `HTTP 301`, which reads like a
 * refusal rather than a move.
 */
export async function requestHttp2(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<Http2Reply> {
  let target = new URL(url);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const reply = await once(target, headers, timeoutMs);
    if (reply.location === null) return reply;
    target = reply.location;
  }

  throw new Error(`More than ${MAX_REDIRECTS} redirects starting at ${url}.`);
}
