import type { VercelRequest, VercelResponse } from '@vercel/node';

/** No imports beyond types: it separates a broken build from a broken database. */
export default function handler(_request: VercelRequest, response: VercelResponse): void {
  response.status(200).json({
    ok: true,
    node: process.version,
    hasDatabaseUrl: typeof process.env.DATABASE_URL === 'string',
    hasIngestToken: typeof process.env.INGEST_TOKEN === 'string',
  });
}
