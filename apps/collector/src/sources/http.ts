/**
 * We identify honestly instead of pretending to be Chrome. Verified: both portals
 * answer this header with a normal 200, so there is no reason to disguise the client.
 */
export const USER_AGENT = 'FlatRadar/0.1 (+https://github.com/Dotims/flatradar)';

const RETRY_DELAYS_MS = [1_000, 3_000, 9_000];

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** 429 and server errors are transient; retrying a 404 or a 403 is pointless. */
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/** Shared by every fetch here: honest headers, one timeout, retries only where useful. */
async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const { headers = {}, timeoutMs = 15_000 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'pl-PL,pl;q=0.9',
          ...headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const error = new HttpError(response.status, url);
        if (!isRetryable(response.status)) throw error;
        lastError = error;
      } else {
        return await response.text();
      }
    } catch (error) {
      // Network failure or timeout: worth another attempt as well.
      if (error instanceof HttpError && !isRetryable(error.status)) throw error;
      lastError = error;
    }

    const delay = RETRY_DELAYS_MS[attempt];
    if (delay !== undefined) await sleep(delay);
  }

  throw lastError;
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const body = await fetchText(url, {
    ...options,
    headers: { Accept: 'application/json', ...options.headers },
  });

  return JSON.parse(body) as T;
}

/** For pages we read rather than call: Otodom hides its build id in the search HTML. */
export async function fetchHtml(url: string, options: FetchOptions = {}): Promise<string> {
  return fetchText(url, {
    ...options,
    headers: { Accept: 'text/html', ...options.headers },
  });
}
