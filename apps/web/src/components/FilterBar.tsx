import { useEffect, useRef, useState } from 'react';
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
      className="num w-[4.25rem] rounded-lg border border-line bg-graphite-900 px-2 py-1 text-sm text-ink transition-colors placeholder:text-ink-faint hover:border-line-strong focus:border-signal-400 focus:outline-none"
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
    <div className="flex flex-col gap-1">
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
 * Districts, spelled out, but floating rather than in the bar. Nineteen chips wrap to two
 * rows and took 130px off the top of the page permanently, which is height the map needs
 * more than the filters do. A panel that opens in place would take it back on every use;
 * this one is drawn over the page instead, so the layout underneath never moves.
 *
 * They are still one click from the bar and every district is still its own chip: an
 * earlier version hid them behind a summary reading "10 ukrytych" and the owner could not
 * find a way to edit it at all.
 */
function DistrictPicker({
  districts,
  hidden,
  onChange,
}: {
  districts: string[];
  hidden: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // Pointerdown rather than click, so the panel is already gone by the time a press
    // elsewhere on the page turns into that element's own click.
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && holder.current?.contains(target) !== true) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (districts.length === 0) return null;
  const shown = districts.length - hidden.filter((name) => districts.includes(name)).length;
  const narrowed = shown < districts.length;

  return (
    <div ref={holder} className="relative flex flex-col gap-1">
      <span className="tag">dzielnice</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[0.6875rem] tracking-[0.06em] uppercase transition-colors duration-150 ${
          narrowed
            ? 'border-signal-400/60 bg-signal-500/10 text-signal-300'
            : 'border-line text-ink-faint hover:border-line-strong hover:text-ink-dim'
        }`}
      >
        {shown} z {districts.length}
        <span aria-hidden="true" className={`text-[0.5rem] ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {open && (
        <div className="rule absolute top-full left-0 z-50 mt-2 w-[36rem] max-w-[calc(100vw-3rem)] rounded-xl bg-graphite-950 p-4 shadow-2xl shadow-black/40">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
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

          <div className="mt-3 flex flex-wrap gap-1.5">
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
      )}
    </div>
  );
}

/**
 * One row across the top, the way the portals do it. As a right-hand rail it took a
 * column the map needed, and as a two-storey block it took the height.
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
    <section aria-label="Filtry" className="flex flex-wrap items-end gap-x-5 gap-y-3">
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

      <DistrictPicker
        districts={districts}
        hidden={filters.hiddenDistricts}
        onChange={(hiddenDistricts) => set({ hiddenDistricts })}
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
    </section>
  );
}
