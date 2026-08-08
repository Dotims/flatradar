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

export async function fetchJson<T>(
  url: string,
  options: { headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<T> {
  const { headers = {}, timeoutMs = 15_000 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
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
        return (await response.json()) as T;
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
