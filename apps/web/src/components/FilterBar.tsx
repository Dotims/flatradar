import {
  DEFAULT_FILTERS,
  DEFAULT_HIDDEN_DISTRICTS,
  NO_DISTRICT,
  type Filters,
} from '../filters.ts';

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
      className="num w-[4.5rem] rounded-lg border border-line bg-graphite-900 px-2 py-1 text-sm text-ink transition-colors placeholder:text-ink-faint hover:border-line-strong focus:border-signal-400 focus:outline-none"
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
        {label} <span className="text-ink-mute">{suffix}</span>
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

function Pill({
  on,
  onClick,
  children,
  title,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      className={`rounded-full border px-3 py-1.5 font-mono text-[0.6875rem] tracking-[0.06em] uppercase transition-colors duration-150 ${
        on
          ? 'border-signal-400/60 bg-signal-500/10 text-signal-300'
          : 'border-line text-ink-faint hover:border-line-strong hover:text-ink-dim'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Districts, spelled out. This was a <details> summary reading "10 ukrytych" and the
 * owner could not find a way to edit it at all, so the chips are on the page, every
 * district is one click, and the two bulk actions say what they do.
 */
function Districts({
  districts,
  hidden,
  onChange,
}: {
  districts: string[];
  hidden: string[];
  onChange: (next: string[]) => void;
}) {
  if (districts.length === 0) return null;
  const shown = districts.length - hidden.filter((name) => districts.includes(name)).length;

  return (
    <div className="mt-3.5 border-t border-line pt-3.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <span className="tag">
          dzielnice
          <span className="ml-1.5 text-ink-mute normal-case">
            ({shown} z {districts.length})
          </span>
        </span>
        <button
          type="button"
          onClick={() => onChange([])}
          className="tag normal-case underline decoration-line underline-offset-2 transition-colors hover:text-ink-dim"
        >
          zaznacz wszystkie
        </button>
        <button
          type="button"
          onClick={() => onChange([...districts])}
          className="tag normal-case underline decoration-line underline-offset-2 transition-colors hover:text-ink-dim"
        >
          odznacz wszystkie
        </button>
        <button
          type="button"
          onClick={() => onChange([...DEFAULT_HIDDEN_DISTRICTS])}
          className="tag normal-case underline decoration-line underline-offset-2 transition-colors hover:text-ink-dim"
        >
          moje domyślne
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {districts.map((district) => {
          const on = !hidden.includes(district);
          return (
            <button
              key={district}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(toggle(hidden, district))}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.6875rem] tracking-[0.04em] transition-colors duration-150 ${
                on
                  ? 'border-signal-400/50 bg-signal-500/10 text-signal-300'
                  : 'border-line text-ink-mute hover:border-line-strong hover:text-ink-dim'
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid size-3 place-items-center rounded-[3px] border text-[8px] leading-none ${
                  on ? 'border-signal-400/70' : 'border-line-strong'
                }`}
              >
                {on ? '✓' : ''}
              </span>
              {district === NO_DISTRICT ? 'bez dzielnicy' : district}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Across the top rather than down the side. As a right-hand rail it took a column the
 * map needed, and the map is the half of this page that cannot be read in a narrow strip.
 */
export function FilterBar({
  filters,
  districts,
  favourites,
  rejected,
  onChange,
}: {
  filters: Filters;
  districts: string[];
  favourites: number;
  rejected: number;
  onChange: (next: Filters) => void;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

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

        <div className="flex flex-wrap items-center gap-2">
          <Pill on={filters.privateOnly} onClick={() => set({ privateOnly: !filters.privateOnly })}>
            tylko prywatne
          </Pill>
          <Pill
            on={filters.favouritesOnly}
            title="Pokaż wyłącznie oferty dodane do ulubionych"
            onClick={() => set({ favouritesOnly: !filters.favouritesOnly })}
          >
            ulubione{favourites > 0 ? ` · ${favourites}` : ''}
          </Pill>
          {rejected > 0 && (
            <Pill
              on={filters.showRejected}
              title="Pokaż oferty, które wykluczyłeś"
              onClick={() => set({ showRejected: !filters.showRejected })}
            >
              wykluczone · {rejected}
            </Pill>
          )}
        </div>

        <button
          type="button"
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="tag ml-auto normal-case transition-colors hover:text-ink-dim"
        >
          przywróć domyślne
        </button>
      </div>

      <Districts
        districts={districts}
        hidden={filters.hiddenDistricts}
        onChange={(hiddenDistricts) => set({ hiddenDistricts })}
      />
    </section>
  );
}
