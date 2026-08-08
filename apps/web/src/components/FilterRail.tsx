import { DEFAULT_FILTERS, NO_DISTRICT, type Filters } from '../filters.ts';
import { TIER } from '../tiers.ts';
import type { Tier } from '../types.ts';

const TIERS: Tier[] = ['top', 'worth', 'other'];

function Pill({
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
      aria-pressed={on}
      className={`rounded-full border px-3 py-1 font-mono text-[0.6875rem] tracking-[0.06em] uppercase transition-colors duration-150 ${
        on
          ? 'border-signal-500/60 bg-signal-500/10 text-signal-300'
          : 'border-line text-ink-faint hover:border-line-strong hover:text-ink-dim'
      }`}
    >
      {children}
    </button>
  );
}

function Slider({
  label,
  value,
  suffix,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="tag">{label}</span>
        <span className="num text-sm text-signal-300">
          {value.toLocaleString('pl-PL')} {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-signal-500"
      />
    </label>
  );
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function FilterRail({
  filters,
  districts,
  onChange,
}: {
  filters: Filters;
  districts: string[];
  onChange: (next: Filters) => void;
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
        <Slider
          label="koszt całkowity do"
          value={filters.maxCostPln}
          suffix="zł"
          min={1000}
          max={5000}
          step={50}
          onChange={(maxCostPln) => onChange({ ...filters, maxCostPln })}
        />
        <Slider
          label="metraż od"
          value={filters.minAreaM2}
          suffix="m²"
          min={0}
          max={80}
          step={5}
          onChange={(minAreaM2) => onChange({ ...filters, minAreaM2 })}
        />
      </div>

      <div>
        <span className="tag">ocena</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {TIERS.map((tier) => (
            <Pill
              key={tier}
              on={filters.tiers.includes(tier)}
              title={TIER[tier].rule}
              onClick={() => onChange({ ...filters, tiers: toggle(filters.tiers, tier) })}
            >
              {TIER[tier].label}
            </Pill>
          ))}
          <Pill
            on={filters.privateOnly}
            onClick={() => onChange({ ...filters, privateOnly: !filters.privateOnly })}
          >
            tylko prywatne
          </Pill>
        </div>
      </div>

      {districts.length > 0 && (
        <details className="group">
          <summary className="tag cursor-pointer list-none transition-colors hover:text-ink-dim">
            dzielnice{' '}
            {filters.districts.length > 0 && (
              <span className="text-signal-400">[{filters.districts.length}]</span>
            )}
            <span className="ml-1 inline-block transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {districts.map((district) => (
              <Pill
                key={district}
                on={filters.districts.includes(district)}
                onClick={() =>
                  onChange({ ...filters, districts: toggle(filters.districts, district) })
                }
              >
                {district === NO_DISTRICT ? 'bez dzielnicy' : district}
              </Pill>
            ))}
          </div>
        </details>
      )}

      <button
        type="button"
        onClick={() => onChange(DEFAULT_FILTERS)}
        className="tag justify-self-start normal-case transition-colors hover:text-ink-dim"
      >
        wyczyść filtry
      </button>
    </div>
  );
}
