/**
 * What a cell shows when the portal did not state the figure. A plain hyphen, not an
 * em dash: the repo writes regular dashes everywhere, and one constant keeps the empty
 * cells identical instead of drifting apart the next time one of them is edited.
 */
const BLANK = '-';

export function pln(value: number | null): string {
  if (value === null) return BLANK;
  return `${value.toLocaleString('pl-PL')} zł`;
}

export function area(value: number | null): string {
  if (value === null) return BLANK;
  return `${value.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} m²`;
}

export function rooms(value: number | null): string {
  if (value === null) return BLANK;
  if (value === 1) return 'kawalerka';
  return `${value} pok.`;
}

const RELATIVE = new Intl.RelativeTimeFormat('pl', { numeric: 'always' });

/**
 * "8 minut temu", "3 godziny temu". Polish inflects by count in three classes, so the
 * counts go through Intl rather than a hand-rolled suffix that produced "1 dni temu".
 */
export function since(iso: string | null): string {
  if (iso === null) return BLANK;

  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'przed chwilą';
  if (minutes < 60) return RELATIVE.format(-minutes, 'minute');

  const hours = Math.round(minutes / 60);
  if (hours < 24) return RELATIVE.format(-hours, 'hour');

  return RELATIVE.format(-Math.round(hours / 24), 'day');
}

/** Minutes since an ISO stamp, or null. Callers decide what counts as stale. */
export function minutesSince(iso: string | null): number | null {
  if (iso === null) return null;
  const value = new Date(iso).getTime();
  if (Number.isNaN(value)) return null;
  return Math.round((Date.now() - value) / 60_000);
}

export function pricePerM2(price: number | null, m2: number | null): string {
  if (price === null || m2 === null || m2 <= 0) return BLANK;
  return `${Math.round(price / m2).toLocaleString('pl-PL')} zł/m²`;
}
