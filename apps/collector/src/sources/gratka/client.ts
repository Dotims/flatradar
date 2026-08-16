import { fetchHtml, sleep } from '../http.ts';
import { readSearchPage } from './parse.ts';
import type { GratkaListItem } from './types.ts';

const ORIGIN = 'https://gratka.pl';
const SEARCH_PATH = '/nieruchomosci/mieszkania/krakow/wynajem';

/** Thirty five to a page, and not ours to change. */
const PAGE_SIZE = 35;

/** Pause between pages: there is no hurry, and the service is not ours. */
const PAGE_DELAY_MS = 1_000;

export interface FetchGratkaOptions {
  pages?: number;
}

/**
 * The newest listings, from the page itself.
 *
 * Gratka is a Nuxt application: the search results are in the page, as JSON, in the
 * `__NUXT_DATA__` script tag. `_payload.json` looks like the endpoint to ask instead and
 * is not one - it is a cached prerender of page one that ignores `?page=` and `?sort=`
 * and answers with the same thirty five listings whatever you ask it for.
 *
 * No sort parameter, on purpose: the default is already refreshed-newest-first, which is
 * what the run needs, and asking for `?sort=newest` costs a redirect to say so.
 *
 * Shallow like the other two. Running every fifteen minutes, a day's listings are about
 * thirty and the first two pages cover them several times over.
 */
export async function fetchGratkaOffers(
  options: FetchGratkaOptions = {},
): Promise<GratkaListItem[]> {
  const { pages = 2 } = options;
  const collected: GratkaListItem[] = [];

  for (let page = 1; page <= pages; page++) {
    const url = new URL(`${ORIGIN}${SEARCH_PATH}`);
    if (page > 1) url.searchParams.set('page', String(page));

    const { nodes } = await fetchHtml(url.toString()).then(readSearchPage);
    collected.push(...nodes);

    // A short page means there is nothing more to read.
    if (nodes.length < PAGE_SIZE) break;
    if (page < pages) await sleep(PAGE_DELAY_MS);
  }

  return collected;
}
