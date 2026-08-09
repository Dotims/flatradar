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

/** A 404 means the build id expired, so refresh it once and retry. */
async function fetchData<T extends { pageProps: { __N_REDIRECT?: string } }>(
  toPath: (buildId: string) => string,
): Promise<T> {
  try {
    return await fetchJson<T>(`${ORIGIN}${toPath(await getBuildId())}`);
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 404) throw error;
    return await fetchJson<T>(`${ORIGIN}${toPath(await getBuildId(true))}`);
  }
}

/**
 * Next.js sends redirects as status 200 with a marker in the body, not a header. On a
 * search that means the query is wrong and there is nothing to salvage.
 */
function assertNotRedirect(response: { pageProps: { __N_REDIRECT?: string } }, url: string): void {
  const target = response.pageProps.__N_REDIRECT;
  if (target !== undefined) {
    throw new Error(`Otodom redirected ${url} to ${target}; the query parameters are wrong.`);
  }
}

/** Otodom serves 36 per page unless asked; 72 is the most it accepts. */
const PAGE_SIZE = 72;

export interface FetchOtodomOptions {
  pages?: number;
  onPage?: (page: number, totalPages: number, items: number) => void;
}

/**
 * Newest first, so a run cut short keeps the listings that matter. Two pages cover
 * fifteen minutes of new adverts; the backfill passes the full page count instead.
 */
export async function fetchOtodomList(options: FetchOtodomOptions = {}): Promise<OtodomListItem[]> {
  const { pages = 2, onPage } = options;
  const collected: OtodomListItem[] = [];

  for (let page = 1; page <= pages; page++) {
    const query = new URLSearchParams({
      by: 'LATEST',
      direction: 'DESC',
      limit: String(PAGE_SIZE),
    });
    if (page > 1) query.set('page', String(page));

    const path = `${SEARCH_PATH}.json?${query.toString()}`;
    const response = await fetchData<OtodomSearchResponse>(
      (buildId) => `/_next/data/${buildId}${path}`,
    );
    assertNotRedirect(response, path);

    const search = response.pageProps.data?.searchAds;
    const items = search?.items ?? [];
    collected.push(...items);
    onPage?.(page, search?.pagination?.totalPages ?? page, items.length);

    if (items.length === 0) break;
    if (page >= (search?.pagination?.totalPages ?? page)) break;
    if (page < pages) await sleep(REQUEST_DELAY_MS);
  }

  return collected;
}

function adPath(slug: string): (buildId: string) => string {
  return (buildId) =>
    `/_next/data/${buildId}/pl/oferta/${slug}.json?id=${encodeURIComponent(slug)}`;
}

/**
 * The only place with the description and the exact pin. One request per listing.
 *
 * Slugs on the results page drift from the canonical ones - a missing hyphen is enough -
 * and Otodom answers those with a redirect rather than the advert. Following it once
 * recovers a listing that is perfectly real; refusing to sank a whole backfill.
 */
export async function fetchOtodomAd(slug: string): Promise<OtodomAdResponse['pageProps']['ad']> {
  const response = await fetchData<OtodomAdResponse>(adPath(slug));
  const target = response.pageProps.__N_REDIRECT;
  if (target === undefined) return response.pageProps.ad;

  const canonical = /\/pl\/oferta\/([^/?#]+)/.exec(target)?.[1];
  if (canonical === undefined || canonical === slug) {
    throw new Error(`Otodom redirected the listing ${slug} to ${target}.`);
  }

  await sleep(REQUEST_DELAY_MS);
  return (await fetchData<OtodomAdResponse>(adPath(canonical))).pageProps.ad;
}

/** For tests, which must not inherit a build id from an earlier case. */
export function resetBuildIdCache(): void {
  cachedBuildId = null;
}
