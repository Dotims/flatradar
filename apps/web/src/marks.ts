import { useCallback, useState } from 'react';
import type { Mark, Offer } from './types.ts';

const MARKS_KEY = 'flatradar:marks';

/** Only what this module needs, so a test can pass a plain object instead of a browser. */
export interface MarkStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

function toMark(value: unknown): Mark | null {
  return value === 'favourite' || value === 'rejected' ? value : null;
}

/**
 * Marks live in the browser rather than the database because the page is shared. A
 * shared table would mean one visitor's rejection removed a flat from everybody's list,
 * including the owner's.
 *
 * Local storage is editable by hand, so its contents are read as untrusted input:
 * anything unexpected is dropped rather than thrown, since a corrupt key must not cost
 * someone the whole page.
 */
export function readMarks(storage: MarkStorage): Map<number, Mark> {
  const marks = new Map<number, Mark>();

  let parsed: unknown;
  try {
    parsed = JSON.parse(storage.getItem(MARKS_KEY) ?? '{}');
  } catch {
    return marks;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return marks;

  for (const [id, value] of Object.entries(parsed)) {
    const mark = toMark(value);
    // Object keys are strings; only the ones that are really row ids survive.
    if (mark !== null && /^\d+$/.test(id)) marks.set(Number(id), mark);
  }

  return marks;
}

export function writeMarks(storage: MarkStorage, marks: Map<number, Mark>): void {
  const plain: Record<string, Mark> = {};
  for (const [id, mark] of marks) plain[String(id)] = mark;
  storage.setItem(MARKS_KEY, JSON.stringify(plain));
}

/** The API knows nothing about marks, so the list is stamped with them on arrival. */
export function withMarks(offers: Offer[], marks: Map<number, Mark>): Offer[] {
  return offers.map((offer) => ({ ...offer, mark: marks.get(offer.id) ?? null }));
}

export function useMarks(): {
  marks: Map<number, Mark>;
  setMark: (id: number, next: Mark | null) => void;
} {
  const [marks, setMarks] = useState<Map<number, Mark>>(() => readMarks(window.localStorage));

  const setMark = useCallback((id: number, next: Mark | null) => {
    setMarks((current) => {
      const updated = new Map(current);
      if (next === null) updated.delete(id);
      else updated.set(id, next);

      // Written where the change happens, not in an effect: an effect would also fire on
      // the first render and write back what was just read.
      writeMarks(window.localStorage, updated);
      return updated;
    });
  }, []);

  return { marks, setMark };
}
