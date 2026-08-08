import { DEFAULT_FILTERS, NO_DISTRICT, type Filters } from '../filters.ts';
import { TIER } from '../tiers.ts';
import type { Tier } from '../types.ts';

const TIERS: Tier[] = ['top', 'worth', 'other'];

function Chip({
  on,
  onClick,
  title,
  children,
}: {
  on: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
        on
          ? 'border-ember-500/60 bg-ember-500/15 text-ember-200'
          : 'border-white/10 bg-white/5 text-stone-400 hover:border-white/25 hover:text-stone-200'
      }`}
    >
      {children}
    </button>
  );
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function FilterBar({
  filters,
  districts,
  onChange,
}: {
  filters: Filters;
  districts: string[];
  onChange: (next: Filters) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-ash-900/60 p-4 backdrop-blur sm:p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-medium tracking-wide text-stone-400 uppercase">
              Koszt całkowity do
            </span>
            <span className="font-semibold tabular-nums text-ember-300">
              {filters.maxCostPln.toLocaleString('pl-PL')} zł
            </span>
          </div>
          <input
            type="range"
            min={1000}
            max={5000}
            step={50}
            value={filters.maxCostPln}
            onChange={(event) => onChange({ ...filters, maxCostPln: Number(event.target.value) })}
            className="w-full accent-ember-500"
          />
        </label>

        <label className="block">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-medium tracking-wide text-stone-400 uppercase">
              Metraż od
            </span>
            <span className="font-semibold tabular-nums text-ember-300">
              {filters.minAreaM2} m²
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={80}
            step={5}
            value={filters.minAreaM2}
            onChange={(event) => onChange({ ...filters, minAreaM2: Number(event.target.value) })}
            className="w-full accent-ember-500"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {TIERS.map((tier) => (
          <Chip
            key={tier}
            on={filters.tiers.includes(tier)}
            title={TIER[tier].rule}
            onClick={() => onChange({ ...filters, tiers: toggle(filters.tiers, tier) })}
          >
            <span className={`mr-1.5 inline-block size-1.5 rounded-full ${TIER[tier].dot}`} />
            {TIER[tier].label}
          </Chip>
        ))}

        <span className="mx-1 h-5 w-px bg-white/10" />

        <Chip
          on={filters.privateOnly}
          onClick={() => onChange({ ...filters, privateOnly: !filters.privateOnly })}
        >
          Tylko prywatne
        </Chip>

        <button
          type="button"
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="ml-auto text-xs text-stone-500 underline-offset-4 transition hover:text-stone-300 hover:underline"
        >
          Wyczyść
        </button>
      </div>

      {districts.length > 0 && (
        <details className="group mt-4">
          <summary className="cursor-pointer list-none text-xs font-medium tracking-wide text-stone-400 uppercase transition hover:text-stone-200">
            Dzielnice
            {filters.districts.length > 0 && (
              <span className="ml-2 rounded-full bg-ember-500/20 px-2 py-0.5 text-ember-300 normal-case">
                {filters.districts.length}
              </span>
            )}
            <span className="ml-1 inline-block transition group-open:rotate-90">›</span>
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {districts.map((district) => (
              <Chip
                key={district}
                on={filters.districts.includes(district)}
                onClick={() =>
                  onChange({ ...filters, districts: toggle(filters.districts, district) })
                }
              >
                {district === NO_DISTRICT ? 'bez dzielnicy' : district}
              </Chip>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
