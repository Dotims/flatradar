import { area, pln, pricePerM2, rooms, since } from '../format.ts';
import { CERTAINTY, TIER } from '../tiers.ts';
import type { Offer } from '../types.ts';

export function OfferCard({
  offer,
  active,
  onHover,
}: {
  offer: Offer;
  active: boolean;
  onHover: (id: number | null) => void;
}) {
  const tier = TIER[offer.tier];
  const certainty = CERTAINTY[offer.costCertainty];

  return (
    <article
      onMouseEnter={() => onHover(offer.id)}
      onMouseLeave={() => onHover(null)}
      className={`rule relative rounded-xl bg-graphite-950 p-5 transition-colors duration-150 ${
        active ? 'border-signal-500/60 bg-graphite-900' : 'hover:border-line-strong'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`tag ${offer.tier === 'top' ? 'text-signal-400' : ''}`}>
              {tier.label}
            </span>
            <span className="tag text-ink-faint/70">/ {offer.source}</span>
            {offer.isPrivateOwner === true && <span className="tag">/ prywatne</span>}
          </div>

          <a
            href={offer.url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 block text-[0.95rem] leading-snug font-medium text-ink underline-offset-4 transition-colors hover:text-signal-300 hover:underline"
          >
            {offer.title}
          </a>
        </div>

        <div className="shrink-0 text-right">
          <div
            className={`num text-2xl leading-none ${offer.tier === 'top' ? 'lit-num' : 'text-ink'}`}
          >
            {pln(offer.totalCostPln)}
          </div>
          <div className="tag mt-1.5 normal-case" title={certainty.hint}>
            {certainty.label}
          </div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 sm:grid-cols-4">
        {[
          ['dzielnica', offer.district ?? 'brak'],
          ['metraż', area(offer.areaM2)],
          ['pokoje', rooms(offer.rooms)],
          ['za m²', pricePerM2(offer.pricePln, offer.areaM2)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="tag">{label}</dt>
            <dd className="num mt-0.5 truncate text-sm text-ink-dim">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span className="num text-ink-faint">
          {pln(offer.pricePln)} + {pln(offer.rentPln)}
        </span>
        <span className="num text-ink-faint">{since(offer.createdAtSource)}</span>
      </div>
    </article>
  );
}
