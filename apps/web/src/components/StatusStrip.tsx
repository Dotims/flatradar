import { minutesSince, since } from '../format.ts';
import { TIER } from '../tiers.ts';
import type { SourceStatus, Tier } from '../types.ts';
import type { PipelineCounts } from './PipelineGraph.tsx';

const STALE_AFTER_MIN = 40;

function Feed({ status, name }: { status: SourceStatus | undefined; name: string }) {
  const failed = status?.ok === false;
  const age = minutesSince(status?.lastCollectedAt ?? null);
  const stale = age !== null && age > STALE_AFTER_MIN;

  return (
    <span
      className="flex items-baseline gap-1.5"
      title={
        status === undefined
          ? `${name}: brak danych o zbiorze`
          : `${name}: ${failed ? 'ostatni zbiór nie powiódł się' : 'zebrano'} ${since(status.lastCollectedAt)}`
      }
    >
      <span className="tag">{name}</span>
      <span
        className={`num text-xs ${failed ? 'text-red-400' : stale ? 'text-amber-400' : 'text-ink-dim'}`}
      >
        {failed ? 'błąd' : since(status?.lastCollectedAt ?? null)}
      </span>
    </span>
  );
}

/**
 * The pipeline as one line. The full graph explains the system and the owner settled
 * those questions weeks ago, so it folds away and this keeps the two facts that change:
 * how fresh each feed is, and how many listings sit in each verdict.
 */
export function StatusStrip({
  counts,
  sources,
  selectedTiers,
  onToggleTier,
  expanded,
  onToggleExpanded,
}: {
  counts: PipelineCounts;
  sources: SourceStatus[];
  selectedTiers: Tier[];
  onToggleTier: (tier: Tier) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const byName = (name: string) => sources.find((status) => status.source === name);

  return (
    <div className="rule flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl bg-graphite-950 px-4 py-3">
      <div className="flex items-center gap-4">
        <Feed status={byName('olx')} name="olx" />
        <Feed status={byName('otodom')} name="otodom" />
      </div>

      <span className="hidden h-4 w-px bg-line sm:block" />

      <div className="flex flex-wrap items-center gap-2">
        {(['top', 'worth', 'other'] as const).map((tier) => {
          const on = selectedTiers.includes(tier);
          return (
            <button
              key={tier}
              type="button"
              onClick={() => onToggleTier(tier)}
              aria-pressed={on}
              title={TIER[tier].rule}
              className={`flex items-baseline gap-1.5 rounded-full border px-3 py-1 transition-colors duration-150 ${
                on
                  ? 'border-signal-500/60 bg-signal-500/10'
                  : 'border-line hover:border-line-strong'
              }`}
            >
              <span className={`num text-sm ${tier === 'top' && on ? 'lit-num' : 'text-ink'}`}>
                {counts.tiers[tier]}
              </span>
              <span className="tag">{TIER[tier].label}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        className="tag ml-auto normal-case transition-colors hover:text-ink-dim"
      >
        {expanded ? 'zwiń przepływ' : `przepływ · ${counts.total} ocenionych`}
      </button>
    </div>
  );
}
