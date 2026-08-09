import { DEFAULT_FILTERS, NO_DISTRICT, type Filters } from '../filters.ts';

/** Blank means unbounded, so an empty box has to survive the round trip as null. */
function toBound(raw: string): number | null {
  if (raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function Bound({
  value,
  placeholder,
  ariaLabel,
  onChange,
}: {
  value: number | null;
  placeholder: string;
  ariaLabel: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      value={value ?? ''}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(event) => onChange(toBound(event.target.value))}
      className="num w-[4.5rem] rounded-lg border border-line bg-graphite-900 px-2 py-1 text-sm text-ink transition-colors placeholder:text-ink-faint hover:border-line-strong focus:border-signal-500 focus:outline-none"
    />
  );
}

function Range({
  label,
  suffix,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string;
  suffix: string;
  from: number | null;
  to: number | null;
  onFrom: (value: number | null) => void;
  onTo: (value: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="tag">
        {label} <span className="text-ink-faint/70">{suffix}</span>
      </span>
      <div className="flex items-center gap-1.5">
        <Bound value={from} placeholder="od" ariaLabel={`${label} od`} onChange={onFrom} />
        <span className="text-ink-faint">–</span>
        <Bound value={to} placeholder="do" ariaLabel={`${label} do`} onChange={onTo} />
      </div>
    </div>
  );
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

/**
 * Across the top rather than down the side. As a right-hand rail it took a column the
 * map needed, and the map is the half of this page that cannot be read in a narrow strip.
 */
export function FilterBar({
  filters,
  districts,
  onChange,
}: {
  filters: Filters;
  districts: string[];
  onChange: (next: Filters) => void;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const hidden = filters.hiddenDistricts.length;

  return (
    <section aria-label="Filtry" className="rule rounded-xl bg-graphite-950 px-4 py-3.5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <Range
          label="koszt"
          suffix="zł"
          from={filters.minCostPln}
          to={filters.maxCostPln}
          onFrom={(minCostPln) => set({ minCostPln })}
          onTo={(maxCostPln) => set({ maxCostPln })}
        />
        <Range
          label="metraż"
          suffix="m²"
          from={filters.minAreaM2}
          to={filters.maxAreaM2}
          onFrom={(minAreaM2) => set({ minAreaM2 })}
          onTo={(maxAreaM2) => set({ maxAreaM2 })}
        />
        <Range
          label="pokoje"
          suffix=""
          from={filters.minRooms}
          to={filters.maxRooms}
          onFrom={(minRooms) => set({ minRooms })}
          onTo={(maxRooms) => set({ maxRooms })}
        />

        <button
          type="button"
          onClick={() => set({ privateOnly: !filters.privateOnly })}
          aria-pressed={filters.privateOnly}
          className={`rounded-full border px-3 py-1.5 font-mono text-[0.6875rem] tracking-[0.06em] uppercase transition-colors duration-150 ${
            filters.privateOnly
              ? 'border-signal-500/60 bg-signal-500/10 text-signal-300'
              : 'border-line text-ink-faint hover:border-line-strong hover:text-ink-dim'
          }`}
        >
          tylko prywatne
        </button>

        <button
          type="button"
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="tag ml-auto normal-case transition-colors hover:text-ink-dim"
        >
          przywróć domyślne
        </button>
      </div>

      {districts.length > 0 && (
        <details className="group mt-3 border-t border-line pt-3">
          <summary className="tag cursor-pointer list-none normal-case transition-colors hover:text-ink-dim">
            dzielnice
            {hidden > 0 && <span className="text-signal-400"> · {hidden} ukrytych</span>}
            <span className="ml-1 inline-block transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {districts.map((district) => {
              const on = !filters.hiddenDistricts.includes(district);
              return (
                <button
                  key={district}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set({ hiddenDistricts: toggle(filters.hiddenDistricts, district) })
                  }
                  className={`rounded-full border px-2.5 py-1 font-mono text-[0.6875rem] tracking-[0.04em] transition-colors duration-150 ${
                    on
                      ? 'border-signal-500/50 bg-signal-500/10 text-signal-300'
                      : 'border-line text-ink-faint line-through hover:border-line-strong'
                  }`}
                >
                  {district === NO_DISTRICT ? 'bez dzielnicy' : district}
                </button>
              );
            })}
          </div>
        </details>
      )}
    </section>
  );
}
