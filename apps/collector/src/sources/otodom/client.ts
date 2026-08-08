import { fetchHtml, fetchJson, HttpError, sleep } from '../http.ts';
import type { OtodomAdResponse, OtodomListItem, OtodomSearchResponse } from './types.ts';

const ORIGIN = 'https://www.otodom.pl';
const SEARCH_PATH = '/pl/wyniki/wynajem/mieszkanie/malopolskie/krakow/krakow/krakow';

/** Pause between requests: there is no hurry, and the service is not ours. */
const REQUEST_DELAY_MS = 1_000;

/**
 * Otodom serves its pages from Next.js, which exposes the same data at
 * `/_next/data/<buildId>/<page>.json`. The build id changes on every deploy of theirs,
 * without warning, and a stale one answers 404. It is scraped from the search page and
 * kept here until it stops working.
 */
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

/**
 * Next.js answers a redirect with status 200 and a marker in the body instead of a
 * Location header. Without this check the caller sees a successful response with no
 * listings in it and concludes, wrongly, that Kraków has run out of flats.
 */
function assertNotRedirect(response: { pageProps: { __N_REDIRECT?: string } }, url: string): void {
  const target = response.pageProps.__N_REDIRECT;
  if (target !== undefined) {
    throw new Error(`Otodom redirected ${url} to ${target}; the query parameters are wrong.`);
  }
}

/**
 * Runs a data request, and treats a 404 as "the build id expired" rather than as "this
 * page does not exist": it refreshes the id once and tries again. Without that, every
 * deploy on their side would stop collection silently until someone noticed.
 */
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

/**
 * The newest listings first. Shallow on purpose: running every ten to fifteen minutes,
 * anything new is on the first page, and Otodom holds around eighty pages of Kraków
 * rentals that we have no reason to walk through.
 */
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

/**
 * The listing page, fetched one at a time and only for listings that already passed the
 * district and price filters. It is the only place with the description, which is where
 * utilities are stated, and with the exact pin rather than a blurred circle.
 */
export async function fetchOtodomAd(slug: string): Promise<OtodomAdResponse['pageProps']['ad']> {
  const response = await fetchData<OtodomAdResponse>(
    (buildId) => `/_next/data/${buildId}/pl/oferta/${slug}.json?id=${encodeURIComponent(slug)}`,
  );

  return response.pageProps.ad;
}

/** Exposed for tests, which must not inherit a build id from an earlier case. */
export function resetBuildIdCache(): void {
  cachedBuildId = null;
}
