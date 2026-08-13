import { useEffect, useState } from 'react';
import { readKey, SEEN_KEY } from './storage.ts';
import type { Offer } from './types.ts';

/**
 * The moment the listings were last looked at, frozen for the length of this visit.
 *
 * Frozen rather than moving, because the badge has to outlive the visit that is reading
 * it. A boundary brought up to date on load would clear every mark on the first refresh,
 * and one moved as each card scrolled past would clear them while they were being read.
 * It is written when the page is hidden instead, which is the moment the looking actually
 * stopped.
 *
 * A first visit has nothing stored and records now without marking anything, so nobody
 * arrives to four thousand listings all announcing themselves at once.
 */
export function useLastSeen(): string | null {
  const [boundary] = useState<string | null>(() => {
    const stored = readKey(window.localStorage, SEEN_KEY);
    if (stored !== null) return stored;

    window.localStorage.setItem(SEEN_KEY, new Date().toISOString());
    return null;
  });

  useEffect(() => {
    function stamp(): void {
      window.localStorage.setItem(SEEN_KEY, new Date().toISOString());
    }

    function onHidden(): void {
      if (document.visibilityState === 'hidden') stamp();
    }

    document.addEventListener('visibilitychange', onHidden);
    // pagehide as well: a tab closed on a phone does not always get visibilitychange, and
    // a visit that never recorded its end would show the same listings as new for ever.
    window.addEventListener('pagehide', stamp);

    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', stamp);
    };
  }, []);

  return boundary;
}

/**
 * Whether a listing turned up since the boundary. Parsed rather than compared as text:
 * both sides are ISO today, but a driver that ever returned an offset instead of Z would
 * make string comparison quietly wrong rather than loudly broken.
 */
export function isNewSince(offer: Offer, boundary: string | null): boolean {
  if (boundary === null) return false;

  const seen = Date.parse(offer.firstSeenAt);
  const cutoff = Date.parse(boundary);
  if (Number.isNaN(seen) || Number.isNaN(cutoff)) return false;

  return seen > cutoff;
}
