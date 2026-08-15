import type { NotifiableOffer } from '../db/notifications.ts';
import { sleep, USER_AGENT } from '../sources/http.ts';

/** Who to send as, and who to send to. Both come from the environment, never from a row. */
export interface TelegramCredentials {
  botToken: string;
  chatId: string;
}

const RETRY_DELAYS_MS = [1_000, 3_000, 9_000];

/**
 * The bot token is a password: anyone holding it can post as this bot. It only ever
 * appears in the request URL, so this error carries the method and the reason and nothing
 * else. `String(error)` on a failed send has to stay safe to write to a log.
 */
export class TelegramError extends Error {
  constructor(method: string, reason: string) {
    super(`Telegram ${method} failed: ${reason}`);
    this.name = 'TelegramError';
  }
}

/**
 * Titles are written by strangers, so a listing called `<b>okazja</b>` must arrive as
 * those characters rather than as markup. Telegram rejects the whole message on unbalanced
 * tags, which would mean one advert silently stopping the notifications.
 */
function escape(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function pln(amount: number | null): string {
  return amount === null ? 'brak' : `${amount.toLocaleString('pl-PL')} zł`;
}

/** The line under the title: everything needed to rule a flat out without opening it. */
function facts(offer: NotifiableOffer): string {
  const parts = [
    offer.district,
    offer.areaM2 === null ? null : `${offer.areaM2} m²`,
    offer.rooms === null ? null : offer.rooms === 1 ? 'kawalerka' : `${offer.rooms} pok.`,
    offer.floor === null ? null : `piętro ${offer.floor}`,
    offer.isPrivateOwner === true ? 'prywatne' : null,
  ];

  return parts.filter((part) => part !== null).join(' · ');
}

/**
 * What the phone shows. The cost comes first because it is the only number that decides
 * anything: it is rent plus the building fee plus whatever utilities the description
 * named, which is not a figure either portal displays.
 *
 * An assumed building fee is marked as such on that same line, so a figure this project
 * guessed at is never read on a phone as one the advert quoted.
 */
export function offerMessage(offer: NotifiableOffer): string {
  const estimated = offer.costCertainty === 'estimated';
  const rent =
    offer.rentPln === null
      ? `${pln(offer.pricePln)} + czynsz niepodany`
      : `${pln(offer.pricePln)} + ${pln(offer.rentPln)} czynszu`;

  return [
    `<b>${escape(pln(offer.totalCostPln))} miesięcznie</b>${estimated ? ' (szacowane)' : ''}`,
    escape(offer.title),
    escape(facts(offer)),
    escape(`${rent} · ${offer.source}`),
    escape(offer.url),
  ].join('\n');
}

/**
 * The outcome of one call. `waitMs` is what Telegram itself asked for, which it means;
 * `retryable` is false for the answers that never improve by being repeated - 400 is our
 * own message being malformed, 401 a wrong token, 403 the owner having blocked the bot.
 */
type Attempt =
  { sent: true } | { sent: false; reason: string; retryable: boolean; waitMs: number | null };

async function attemptSend(
  url: string,
  credentials: TelegramCredentials,
  text: string,
): Promise<Attempt> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify({ chat_id: credentials.chatId, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(15_000),
    });

    const body = (await response.json()) as {
      ok?: boolean;
      description?: string;
      parameters?: { retry_after?: number };
    };

    if (body.ok === true) return { sent: true };

    const askedFor = body.parameters?.retry_after;
    return {
      sent: false,
      reason: body.description ?? `HTTP ${response.status}`,
      retryable: response.status === 429 || response.status >= 500,
      waitMs: askedFor === undefined ? null : askedFor * 1_000,
    };
  } catch (error) {
    // A timeout, a network failure, or a body that was not JSON. Worth another attempt.
    return {
      sent: false,
      reason: error instanceof Error ? error.message : 'network failure',
      retryable: true,
      waitMs: null,
    };
  }
}

/**
 * One message. Failures are thrown rather than swallowed: a round that could not tell the
 * owner about a flat has not done its job, and the listing must stay unrecorded so the
 * next round tries again.
 */
export async function sendMessage(credentials: TelegramCredentials, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${credentials.botToken}/sendMessage`;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const result = await attemptSend(url, credentials, text);
    if (result.sent) return;
    if (!result.retryable) throw new TelegramError('sendMessage', result.reason);

    const wait = result.waitMs ?? RETRY_DELAYS_MS[attempt];
    if (wait === undefined) throw new TelegramError('sendMessage', result.reason);
    await sleep(wait);
  }

  throw new TelegramError('sendMessage', 'gave up after retries');
}
