import type { Queryable } from './client.ts';
import { readNumber, readString, type DbRow } from './rows.ts';

/** The owner's verdict, which outranks the rules: keep it, or never show it again. */
export type Mark = 'favourite' | 'rejected';

/**
 * `offer_marks` came with the original schema as a four-state lifecycle
 * (new/seen/shortlisted/rejected) that nothing ever wrote. What the dashboard needs is
 * a two-way mark, so the two vocabularies meet here and nowhere else rather than
 * migrating a table with no rows in it.
 */
const TO_STATE: Record<Mark, string> = { favourite: 'shortlisted', rejected: 'rejected' };

function toMarkFromState(state: string): Mark | null {
  if (state === 'shortlisted') return 'favourite';
  if (state === 'rejected') return 'rejected';
  return null;
}

export function toMark(value: string): Mark {
  if (value === 'favourite' || value === 'rejected') return value;
  throw new Error(`Unknown mark "${value}".`);
}

/** Setting the same mark twice is not an error, and null clears it. */
export async function setMark(
  sql: Queryable,
  offerId: number,
  mark: Mark | null,
  now: string = new Date().toISOString(),
): Promise<void> {
  if (mark === null) {
    await sql`delete from offer_marks where offer_id = ${offerId}`;
    return;
  }

  await sql`
    insert into offer_marks (offer_id, state, updated_at)
    values (${offerId}, ${TO_STATE[mark]}, ${now})
    on conflict (offer_id) do update set state = excluded.state, updated_at = excluded.updated_at
  `;
}

/** Read in one query and attached to the listings, rather than a lookup per row. */
export async function listMarks(sql: Queryable): Promise<Map<number, Mark>> {
  const rows = await sql<DbRow[]>`select offer_id, state from offer_marks`;
  const marks = new Map<number, Mark>();

  for (const row of rows) {
    // The lifecycle states nothing writes are simply not marks.
    const mark = toMarkFromState(readString(row, 'state'));
    if (mark !== null) marks.set(readNumber(row, 'offer_id'), mark);
  }

  return marks;
}
