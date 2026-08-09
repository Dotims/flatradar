import { pln } from '../format.ts';
import type { Offer } from '../types.ts';

/**
 * Listings the portal never placed. They used to vanish from the map with only a
 * counter to admit it; a flat with no pin is still a flat worth seeing, so they sit
 * beside the map rather than behind a number.
 */
export function UnlocatedPanel({
  offers,
  activeId,
  onHover,
  onSelect,
}: {
  offers: Offer[];
  activeId: number | null;
  onHover: (id: number | null) => void;
  onSelect: (id: number) => void;
}) {
  if (offers.length === 0) return null;

  return (
    <div className="rule max-h-44 shrink-0 overflow-y-auto rounded-xl bg-graphite-950 p-3">
      <div className="tag mb-2">bez lokalizacji · {offers.length}</div>
      <ul className="grid list-none gap-1">
        {offers.map((offer) => (
          <li key={offer.id}>
            <button
              type="button"
              onMouseEnter={() => onHover(offer.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(offer.id)}
              className={`flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${
                offer.id === activeId ? 'bg-graphite-900' : 'hover:bg-graphite-900'
              }`}
            >
              <span className="truncate text-xs text-ink-dim">{offer.district ?? offer.title}</span>
              <span
                className={`num shrink-0 text-xs ${offer.tier === 'top' ? 'text-signal-300' : 'text-ink-faint'}`}
              >
                {pln(offer.totalCostPln)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
