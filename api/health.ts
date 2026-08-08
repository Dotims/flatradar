/** No imports on purpose: it separates a broken build from a broken database. */
export default function handler(): Response {
  return Response.json({
    ok: true,
    node: process.version,
    hasDatabaseUrl: typeof process.env.DATABASE_URL === 'string',
    hasIngestToken: typeof process.env.INGEST_TOKEN === 'string',
  });
}
