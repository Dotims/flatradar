import { area, pln, pricePerM2, rooms, since } from '../format.ts';
import { BUDGET_PLN, CERTAINTY, TIER } from '../tiers.ts';
import type { Offer } from '../types.ts';

/** How full the budget is. Over it, the bar saturates and turns red. */
function gauge(total: number | null): { width: string; tone: string } {
  if (total === null) return { width: '0%', tone: 'bg-stone-600' };

  const share = Math.min(total / BUDGET_PLN, 1.35);
  const tone =
    total <= BUDGET_PLN * 0.85
      ? 'bg-gradient-to-r from-ember-400 to-ember-500'
      : total <= BUDGET_PLN
        ? 'bg-gradient-to-r from-ember-500 to-red-500'
        : 'bg-gradient-to-r from-red-600 to-red-700';

  return { width: `${Math.min(share, 1) * 100}%`, tone };
}

export function OfferCard({
  offer,
  index,
  active,
  onHover,
}: {
  offer: Offer;
  index: number;
  active: boolean;
  onHover: (id: number | null) => void;
}) {
  const tier = TIER[offer.tier];
  const certainty = CERTAINTY[offer.costCertainty];
  const bar = gauge(offer.totalCostPln);

  return (
    <article
      onMouseEnter={() => onHover(offer.id)}
      onMouseLeave={() => onHover(null)}
      style={{ animationDelay: `${Math.min(index, 14) * 35}ms` }}
      className={`group animate-rise relative overflow-hidden rounded-2xl border bg-ash-900/70 ring-1 backdrop-blur transition duration-200 hover:-translate-y-0.5 ${
        active
          ? 'border-ember-500/70 ring-ember-500/40 shadow-lg shadow-ember-900/40'
          : `border-white/10 ${tier.ring} hover:border-ember-600/50`
      }`}
    >
      <div className="pointer-events-none absolute -top-24 -right-16 size-48 rounded-full bg-ember-600/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100 sm:opacity-0" />

      <div className="relative flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              title={tier.rule}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-stone-200"
            >
              <span className={`size-1.5 rounded-full ${tier.dot}`} />
              {tier.label}
            </span>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[0.7rem] tracking-wide text-stone-400 uppercase">
              {offer.source}
            </span>
            {offer.isPrivateOwner === true && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[0.7rem] text-emerald-300">
                prywatne
              </span>
            )}
          </div>

          <div className="shrink-0 text-right">
            <div className="text-xl font-semibold tabular-nums text-stone-50 sm:text-2xl">
              {pln(offer.totalCostPln)}
            </div>
            <div title={certainty.hint} className="text-[0.7rem] text-stone-400">
              {certainty.label}
            </div>
          </div>
        </div>

        <a
          href={offer.url}
          target="_blank"
          rel="noreferrer noopener"
          className="line-clamp-2 text-sm font-medium text-stone-100 underline-offset-4 transition hover:text-ember-300 hover:underline"
        >
          {offer.title}
        </a>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-400">
          <span className="text-stone-300">{offer.district ?? 'bez dzielnicy'}</span>
          <span aria-hidden>·</span>
          <span>{area(offer.areaM2)}</span>
          <span aria-hidden>·</span>
          <span>{rooms(offer.rooms)}</span>
          <span aria-hidden>·</span>
          <span>{pricePerM2(offer.pricePln, offer.areaM2)}</span>
        </div>

        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ${bar.tone}`}
              style={{ width: bar.width }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[0.7rem] text-stone-500">
            <span>
              najem {pln(offer.pricePln)} + czynsz {pln(offer.rentPln)}
            </span>
            <span>{since(offer.createdAtSource)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
