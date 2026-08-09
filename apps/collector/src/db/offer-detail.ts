import type { Queryable } from './client.ts';
import { readNullableString, readNumber, readString, type DbRow } from './rows.ts';

export interface OfferDetail {
  id: number;
  source: string;
  url: string;
  title: string;
  /** Portal HTML. The browser renders it as text, never as markup. */
  description: string | null;
  photos: string[];
}

/** OLX serves one templated URL per photo; Otodom ships ready sizes on the ad page. */
function readPhotos(source: string, raw: unknown): string[] {
  if (typeof raw !== 'object' || raw === null) return [];

  if (source === 'olx') {
    const photos = (raw as { photos?: unknown }).photos;
    if (!Array.isArray(photos)) return [];

    return photos
      .map((photo: unknown) =>
        typeof photo === 'object' &&
        photo !== null &&
        typeof (photo as { link?: unknown }).link === 'string'
          ? (photo as { link: string }).link.replace('{width}x{height}', '800x600')
          : null,
      )
      .filter((link): link is string => link !== null);
  }

  const images = (raw as { ad?: { images?: unknown } }).ad?.images;
  if (!Array.isArray(images)) return [];

  return images
    .map((image: unknown) => {
      if (typeof image !== 'object' || image === null) return null;
      const sizes = image as { large?: unknown; medium?: unknown; thumbnail?: unknown };
      const link = sizes.large ?? sizes.medium ?? sizes.thumbnail;
      return typeof link === 'string' ? link : null;
    })
    .filter((link): link is string => link !== null);
}

/** Everything the detail panel shows. Kept out of the list payload: it is far heavier. */
export async function readOfferDetail(sql: Queryable, id: number): Promise<OfferDetail | null> {
  const [row] = await sql<DbRow[]>`
    select id, source, url, title, description, raw from offers where id = ${id}
  `;

  if (row === undefined) return null;

  const source = readString(row, 'source');
  const raw = row['raw'];

  return {
    id: readNumber(row, 'id'),
    source,
    url: readString(row, 'url'),
    title: readString(row, 'title'),
    description: readNullableString(row, 'description'),
    photos: readPhotos(source, typeof raw === 'string' ? JSON.parse(raw) : raw).slice(0, 12),
  };
}
