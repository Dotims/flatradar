export function pln(value: number | null): string {
  if (value === null) return '—';
  return `${value.toLocaleString('pl-PL')} zł`;
}

export function area(value: number | null): string {
  if (value === null) return '—';
  return `${value.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} m²`;
}

export function rooms(value: number | null): string {
  if (value === null) return '—';
  if (value === 1) return 'kawalerka';
  return `${value} pok.`;
}

/** "8 min temu", "3 godz. temu". Absolute dates are noise for a feed this fresh. */
export function since(iso: string | null): string {
  if (iso === null) return '—';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'przed chwilą';
  if (minutes < 60) return `${minutes} min temu`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;

  return `${Math.round(hours / 24)} dni temu`;
}

export function pricePerM2(price: number | null, m2: number | null): string {
  if (price === null || m2 === null || m2 <= 0) return '—';
  return `${Math.round(price / m2).toLocaleString('pl-PL')} zł/m²`;
}
