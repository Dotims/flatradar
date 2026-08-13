import { useCallback, useState } from 'react';
import { readKey, VIEW_KEY } from './storage.ts';

/** How the listing column arranges its cards. */
export type ViewKey = 'list' | 'grid';

export const VIEWS: { key: ViewKey; label: string; hint: string }[] = [
  { key: 'list', label: 'lista', hint: 'Jedna oferta w rzędzie, zdjęcie po lewej' },
  { key: 'grid', label: 'siatka', hint: 'Kafelki, tyle kolumn ile zmieści się w kolumnie' },
];

/**
 * A column rule rather than a column count, because this column is not a fixed width: it
 * is half the screen beside the map, the whole screen below the breakpoint, and the map
 * overlay takes it away entirely. `auto-fill` lets one setting mean two columns on a
 * laptop and four on a wide monitor without a breakpoint per case.
 *
 * The floor is what a tile can be narrowed to before it stops being readable. Below
 * roughly 17rem the district line truncates on most Kraków names.
 */
export const VIEW_LAYOUT: Record<ViewKey, string> = {
  list: 'grid-cols-1',
  grid: 'grid-cols-[repeat(auto-fill,minmax(17rem,1fr))]',
};

/** The list is a row of cards with the photograph beside the text; the grid is tiles. */
export const VIEW_CARD: Record<ViewKey, 'row' | 'tile'> = {
  list: 'row',
  grid: 'tile',
};

function stored(): ViewKey | null {
  const value = readKey(window.localStorage, VIEW_KEY);
  if (value === 'list') return 'list';
  // `dense` was the tighter of two grids that briefly shipped together; the wider one
  // was dropped, and a browser still holding either name means the grid.
  if (value === 'grid' || value === 'dense') return 'grid';
  return null;
}

/**
 * Written on every change, unlike the theme: there is no system preference to fall back
 * to here, so a choice not recorded is a choice lost on the next visit.
 */
export function useView(): { view: ViewKey; setView: (next: ViewKey) => void } {
  const [view, setStateView] = useState<ViewKey>(() => stored() ?? 'list');

  const setView = useCallback((next: ViewKey) => {
    window.localStorage.setItem(VIEW_KEY, next);
    setStateView(next);
  }, []);

  return { view, setView };
}
