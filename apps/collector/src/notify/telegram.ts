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

async function attemptCall(url: string, payload: Record<string, string>): Promise<Attempt> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify(payload),
      // Longer than the portal calls: sendPhoto makes Telegram fetch the image itself,
      // and it answers only once it has.
      signal: AbortSignal.timeout(30_000),
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
 * One call to the API. Failures are thrown rather than swallowed: a round that could not
 * tell the owner about a flat has not done its job, and the listing must stay unrecorded
 * so the next round tries again.
 */
async function call(
  credentials: TelegramCredentials,
  method: string,
  body: Record<string, string>,
): Promise<void> {
  const url = `https://api.telegram.org/bot${credentials.botToken}/${method}`;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const result = await attemptCall(url, { chat_id: credentials.chatId, ...body });
    if (result.sent) return;
    if (!result.retryable) throw new TelegramError(method, result.reason);

    const wait = result.waitMs ?? RETRY_DELAYS_MS[attempt];
    if (wait === undefined) throw new TelegramError(method, result.reason);
    await sleep(wait);
  }

  throw new TelegramError(method, 'gave up after retries');
}

export async function sendMessage(credentials: TelegramCredentials, text: string): Promise<void> {
  await call(credentials, 'sendMessage', { text, parse_mode: 'HTML' });
}

/**
 * The picture is passed as a URL rather than uploaded: Telegram fetches it from the
 * portal's CDN itself, which is one request this project does not make and one image it
 * does not have to hold in memory. Verified against both portals, including OLX's
 * `host:443/path;s=800x600` shape and Otodom's 264-character signed URL.
 */
export async function sendPhoto(
  credentials: TelegramCredentials,
  photo: string,
  caption: string,
): Promise<void> {
  await call(credentials, 'sendPhoto', { photo, caption, parse_mode: 'HTML' });
}

/** A caption is capped at 1024 characters, and a title written in capitals can be long. */
const CAPTION_LIMIT = 1_000;

/**
 * One listing, as one notification. The photograph is what makes a flat recognisable at a
 * glance, so it leads when there is one.
 *
 * A picture the portal has already taken down, or one Telegram cannot fetch, must not cost
 * the owner the alert: the same text is sent without it instead. That failure is not
 * retried as a photograph, because whatever the CDN answered it will answer again.
 */
export async function sendOffer(
  credentials: TelegramCredentials,
  offer: NotifiableOffer,
): Promise<void> {
  const text = offerMessage(offer);

  if (offer.photo !== null && text.length <= CAPTION_LIMIT) {
    try {
      await sendPhoto(credentials, offer.photo, text);
      return;
    } catch (error) {
      if (!(error instanceof TelegramError)) throw error;
      console.error(`photograph refused for offer ${offer.id}, sending text: ${error.message}`);
    }
  }

  await sendMessage(credentials, text);
}
