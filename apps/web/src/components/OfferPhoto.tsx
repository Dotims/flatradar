import { useEffect, useState } from 'react';
import type { Offer, OfferDetail } from '../types.ts';

export type PhotoLayout = 'row' | 'tile';

/**
 * Two shapes, because the two views ask different questions of a photograph. A tile is
 * mostly picture, with the numbers underneath. A row is a line in a list that happens to
 * carry one, so the picture takes a strip down the left and the card keeps the height it
 * had before there were any pictures at all.
 *
 * No rounding here: the card clips its own corners, so a radius on this would only ever
 * show up as a seam inside them.
 */
const FRAME: Record<PhotoLayout, string> = {
  tile: 'aspect-[4/3] w-full border-b border-line',
  row: 'w-32 shrink-0 self-stretch border-r border-line @sm:w-40 @xl:w-52',
};

/**
 * The photograph a card leads with, and the way to the rest of them.
 *
 * The list payload carries one URL per listing, because carrying all of them would add
 * another half megabyte to a body that is already 2.8MB, for a gallery nobody has asked
 * to see. The rest arrive from the detail endpoint the first time somebody pages past
 * the first, for that one listing.
 */
export function OfferPhoto({ offer, layout }: { offer: Offer; layout: PhotoLayout }) {
  const [photos, setPhotos] = useState<string[]>(() => (offer.photo === null ? [] : [offer.photo]));
  const [index, setIndex] = useState(0);
  const [loadingRest, setLoadingRest] = useState(false);
  const [broken, setBroken] = useState(false);

  // A card can be reused for another listing as the list is filtered and sorted.
  useEffect(() => {
    setPhotos(offer.photo === null ? [] : [offer.photo]);
    setIndex(0);
    setBroken(false);
  }, [offer.id, offer.photo]);

  const hasMore = offer.photoCount > photos.length;

  async function loadRest(): Promise<string[]> {
    if (!hasMore) return photos;

    setLoadingRest(true);
    try {
      const response = await fetch(`/api/offers/${offer.id}`);
      if (!response.ok) return photos;

      const detail = (await response.json()) as OfferDetail;
      if (detail.photos.length === 0) return photos;

      setPhotos(detail.photos);
      return detail.photos;
    } catch {
      // A failed fetch leaves the one photograph we already had, which is what the card
      // showed a moment ago. Nothing to report to somebody flicking through pictures.
      return photos;
    } finally {
      setLoadingRest(false);
    }
  }

  async function step(direction: 1 | -1) {
    const available = direction === 1 ? await loadRest() : photos;
    if (available.length === 0) return;

    // Wraps, because a strip of eight photographs with a dead end at each side means
    // clicking back eight times to see the one you passed.
    setIndex((current) => (current + direction + available.length) % available.length);
    setBroken(false);
  }

  if (offer.photo === null || broken) {
    return (
      <div className={`grid place-items-center bg-graphite-900 ${FRAME[layout]}`}>
        <span className="tag px-2 text-center text-ink-mute">
          {broken ? 'zdjęcie zniknęło' : 'bez zdjęcia'}
        </span>
      </div>
    );
  }

  const total = Math.max(offer.photoCount, photos.length);

  return (
    // group/photo rather than group: the card is a group of its own and the arrows must
    // not appear when the pointer is merely somewhere on the card.
    <div className={`group/photo relative overflow-hidden bg-graphite-900 ${FRAME[layout]}`}>
      <img
        src={photos[index] ?? photos[0]}
        alt=""
        // Thousands of cards exist at once and only a handful are ever on screen.
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className="h-full w-full object-cover"
      />

      {total > 1 && (
        <>
          {/* stopPropagation everywhere: a click on the card selects the listing and
              points the map at it, which is not what paging a gallery should do. */}
          {(['prev', 'next'] as const).map((which) => (
            <button
              key={which}
              type="button"
              aria-label={which === 'next' ? 'Następne zdjęcie' : 'Poprzednie zdjęcie'}
              disabled={loadingRest}
              onClick={(event) => {
                event.stopPropagation();
                void step(which === 'next' ? 1 : -1);
              }}
              className={`absolute top-1/2 -translate-y-1/2 rounded-full border border-line-strong bg-scrim/55 px-2 py-1 text-sm text-ink opacity-0 backdrop-blur-[2px] transition-opacity group-hover/photo:opacity-100 focus-visible:opacity-100 disabled:opacity-30 ${
                which === 'next' ? 'right-2' : 'left-2'
              }`}
            >
              {which === 'next' ? '›' : '‹'}
            </button>
          ))}

          <span className="num absolute right-2 bottom-2 rounded-full bg-scrim/55 px-2 py-0.5 text-[0.6875rem] text-ink-dim backdrop-blur-[2px]">
            {index + 1}/{total}
          </span>
        </>
      )}
    </div>
  );
}
