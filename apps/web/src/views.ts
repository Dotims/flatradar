import { useCallback, useState } from 'react';

/** How the listing column arranges its cards. */
export type ViewKey = 'list' | 'grid' | 'dense';

export const VIEW_STORAGE_KEY = 'flatradar:view';

export const VIEWS: { key: ViewKey; label: string; hint: string }[] = [
  { key: 'list', label: 'lista', hint: 'Jedna oferta w rzędzie, wszystkie pola widoczne' },
  { key: 'grid', label: 'siatka', hint: 'Tyle kolumn, ile zmieści się bez ściskania karty' },
  { key: 'dense', label: 'gęsto', hint: 'Więcej ofert na ekranie, węższe karty' },
];

/**
 * Column rules rather than a fixed count, because this column is not a fixed width: it
 * is half the screen beside the map, the whole screen below the breakpoint, and the map
 * overlay takes it away entirely. `auto-fill` lets the same setting mean two columns on
 * a laptop and four on a wide monitor without a breakpoint per case.
 *
 * The floor is what a card can be narrowed to before it stops being readable. Below
 * roughly 17rem the district line truncates on most Kraków names and the price stops
 * fitting beside the title, which is why `dense` stops there rather than lower.
 */
export const VIEW_LAYOUT: Record<ViewKey, string> = {
  list: 'grid-cols-1',
  grid: 'grid-cols-[repeat(auto-fill,minmax(22rem,1fr))]',
  dense: 'grid-cols-[repeat(auto-fill,minmax(17rem,1fr))]',
};

function stored(): ViewKey | null {
  const value = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return value === 'list' || value === 'grid' || value === 'dense' ? value : null;
}

/**
 * Written on every change, unlike the theme: there is no system preference to fall back
 * to here, so a choice not recorded is a choice lost on the next visit.
 */
export function useView(): { view: ViewKey; setView: (next: ViewKey) => void } {
  const [view, setStateView] = useState<ViewKey>(() => stored() ?? 'list');

  const setView = useCallback((next: ViewKey) => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    setStateView(next);
  }, []);

  return { view, setView };
}
