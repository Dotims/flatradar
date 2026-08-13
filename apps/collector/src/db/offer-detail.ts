import type { Queryable } from './client.ts';
import { readNullableString, readNumber, readString, readStringArray, type DbRow } from './rows.ts';

export interface OfferDetail {
  id: number;
  source: string;
  url: string;
  title: string;
  /** Portal HTML. The browser renders it as text, never as markup. */
  description: string | null;
  photos: string[];
}

/** More than a dozen is a viewing, not a shortlist. */
const PHOTO_LIMIT = 12;

/**
 * Everything the detail panel shows. Kept out of the list payload: the description is
 * far heavier than every other field put together, and the list needs one photograph
 * rather than all of them.
 */
export async function readOfferDetail(sql: Queryable, id: number): Promise<OfferDetail | null> {
  const [row] = await sql<DbRow[]>`
    select id, source, url, title, description, photos from offers where id = ${id}
  `;

  if (row === undefined) return null;

  return {
    id: readNumber(row, 'id'),
    source: readString(row, 'source'),
    url: readString(row, 'url'),
    title: readString(row, 'title'),
    description: readNullableString(row, 'description'),
    photos: readStringArray(row, 'photos').slice(0, PHOTO_LIMIT),
  };
}
