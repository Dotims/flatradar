import { useCallback, useEffect, useState } from 'react';
import { readKey, THEME_KEY } from './storage.ts';

export type Theme = 'dark' | 'light';

/** Dark unless the machine asks for light. The design was drawn on black. */
export function preferredTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function storedTheme(): Theme | null {
  const value = readKey(window.localStorage, THEME_KEY);
  return value === 'dark' || value === 'light' ? value : null;
}

/** Radix Colors scopes its dark scales to .dark, so the class is what switches the palette. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset['theme'] = theme;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
}

/**
 * The stored choice outranks the machine's. Nothing is written until the switch is
 * actually thrown, so following the system stays the state a first visit is in rather
 * than a preference the page silently recorded for itself.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? preferredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const follow = (event: MediaQueryListEvent) => {
      if (storedTheme() === null) setTheme(event.matches ? 'light' : 'dark');
    };

    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, []);

  const toggle = useCallback(
    () =>
      setTheme((current) => {
        const next = current === 'dark' ? 'light' : 'dark';
        window.localStorage.setItem(THEME_KEY, next);
        return next;
      }),
    [],
  );

  return { theme, toggle };
}
