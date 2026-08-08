import { fetchHtml, fetchJson, HttpError, sleep } from '../http.ts';
import type { OtodomAdResponse, OtodomListItem, OtodomSearchResponse } from './types.ts';

const ORIGIN = 'https://www.otodom.pl';
const SEARCH_PATH = '/pl/wyniki/wynajem/mieszkanie/malopolskie/krakow/krakow/krakow';

/** The service is not ours. */
const REQUEST_DELAY_MS = 1_000;

// Next.js serves the same data at /_next/data/<buildId>/<page>.json. The build id
// changes on every deploy of theirs and a stale one answers 404.
let cachedBuildId: string | null = null;

function extractBuildId(html: string): string {
  const match = /"buildId":"([^"]+)"/.exec(html);
  if (match?.[1] === undefined) {
    throw new Error('No build id in the Otodom search page. The page structure changed.');
  }
  return match[1];
}

async function getBuildId(forceRefresh = false): Promise<string> {
  if (cachedBuildId !== null && !forceRefresh) return cachedBuildId;

  const html = await fetchHtml(`${ORIGIN}${SEARCH_PATH}`);
  cachedBuildId = extractBuildId(html);
  return cachedBuildId;
}

/** Next.js sends redirects as status 200 with a marker in the body, not a header. */
function assertNotRedirect(response: { pageProps: { __N_REDIRECT?: string } }, url: string): void {
  const target = response.pageProps.__N_REDIRECT;
  if (target !== undefined) {
    throw new Error(`Otodom redirected ${url} to ${target}; the query parameters are wrong.`);
  }
}

/** A 404 means the build id expired, so refresh it once and retry. */
async function fetchData<T extends { pageProps: { __N_REDIRECT?: string } }>(
  toPath: (buildId: string) => string,
): Promise<T> {
  const url = `${ORIGIN}${toPath(await getBuildId())}`;

  try {
    const response = await fetchJson<T>(url);
    assertNotRedirect(response, url);
    return response;
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 404) throw error;

    const retryUrl = `${ORIGIN}${toPath(await getBuildId(true))}`;
    const response = await fetchJson<T>(retryUrl);
    assertNotRedirect(response, retryUrl);
    return response;
  }
}

export interface FetchOtodomOptions {
  pages?: number;
}

/** Newest first. Shallow: polling every 15 minutes, anything new is on page one. */
export async function fetchOtodomList(options: FetchOtodomOptions = {}): Promise<OtodomListItem[]> {
  const { pages = 2 } = options;
  const collected: OtodomListItem[] = [];

  for (let page = 1; page <= pages; page++) {
    const query = new URLSearchParams({ by: 'LATEST', direction: 'DESC' });
    if (page > 1) query.set('page', String(page));

    const response = await fetchData<OtodomSearchResponse>(
      (buildId) => `/_next/data/${buildId}${SEARCH_PATH}.json?${query.toString()}`,
    );

    const items = response.pageProps.data?.searchAds?.items ?? [];
    collected.push(...items);

    if (items.length === 0) break;
    if (page < pages) await sleep(REQUEST_DELAY_MS);
  }

  return collected;
}

/** The only place with the description and the exact pin. One request per listing. */
export async function fetchOtodomAd(slug: string): Promise<OtodomAdResponse['pageProps']['ad']> {
  const response = await fetchData<OtodomAdResponse>(
    (buildId) => `/_next/data/${buildId}/pl/oferta/${slug}.json?id=${encodeURIComponent(slug)}`,
  );

  return response.pageProps.ad;
}

/** For tests, which must not inherit a build id from an earlier case. */
export function resetBuildIdCache(): void {
  cachedBuildId = null;
}
