import { minutesSince, since } from '../format.ts';
import type { SourceStatus } from '../types.ts';

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
        className={`num text-xs ${failed ? 'text-danger' : stale ? 'text-signal-300' : 'text-ink-dim'}`}
      >
        {failed ? 'błąd' : since(status?.lastCollectedAt ?? null)}
      </span>
    </span>
  );
}

/**
 * How fresh each feed is, and how much is in the database. That is the whole of it now:
 * a diagram of the stages between the two used to fold out from here, and it explained a
 * system the owner had stopped needing explained.
 */
export function StatusStrip({ total, sources }: { total: number; sources: SourceStatus[] }) {
  const byName = (name: string) => sources.find((status) => status.source === name);

  return (
    <div className="rule flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl bg-graphite-950 px-4 py-3">
      <div className="flex items-center gap-4">
        <Feed status={byName('olx')} name="olx" />
        <Feed status={byName('otodom')} name="otodom" />
      </div>

      <span className="hidden h-4 w-px bg-line sm:block" />

      <span className="flex items-baseline gap-1.5">
        <span className="num text-sm text-ink">{total}</span>
        <span className="tag">ofert w bazie</span>
      </span>
    </div>
  );
}
