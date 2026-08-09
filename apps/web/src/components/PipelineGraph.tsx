import { minutesSince, since } from '../format.ts';
import type { SourceStatus, Tier } from '../types.ts';

/** Past this, a feed is old enough that the number on screen may not be reality. */
const STALE_AFTER_MIN = 40;

type MarkKind = 'feed' | 'rules' | 'pass' | 'partial' | 'reject';

/** System marks in the world's own grammar: 1px strokes, no fills, no icon font. */
function Mark({ kind }: { kind: MarkKind }) {
  const paths = {
    feed: 'M1 8h4M11 8h4M8 1v4M8 11v4',
    rules: 'M2 5h12M2 11h12M6 2v12',
    pass: 'M2 8l4 4 8-9',
    partial: 'M3 8h10',
    reject: 'M4 4l8 8M12 4l-8 8',
  } as const;

  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" aria-hidden="true">
      <path d={paths[kind]} stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" />
    </svg>
  );
}

export interface PipelineCounts {
  olx: number;
  otodom: number;
  total: number;
  tiers: Record<Tier, number>;
}

type Health = 'fresh' | 'stale' | 'failed' | 'unknown';

function health(status: SourceStatus | undefined): Health {
  if (status === undefined) return 'unknown';
  if (status.ok === false) return 'failed';

  const age = minutesSince(status.lastCollectedAt);
  if (age === null) return 'unknown';
  return age > STALE_AFTER_MIN ? 'stale' : 'fresh';
}

/** The caption under a source count: when it last ran, and whether that run worked. */
function sourceCaption(status: SourceStatus | undefined, fallback: string): string {
  if (status === undefined) return fallback;
  if (status.ok === false) return `zbiór nie powiódł się · ${since(status.lastCollectedAt)}`;
  return `zebrano ${since(status.lastCollectedAt)}`;
}

const HEALTH_TONE: Record<Health, string> = {
  fresh: '',
  stale: 'text-amber-400',
  failed: 'text-red-400',
  unknown: '',
};

/**
 * Percent anchors shared by the SVG connectors and the absolutely placed nodes, so the
 * lines meet the boxes at every width. Only used from lg up.
 */
const AT = {
  sourceX: 13,
  hubX: 50,
  tierX: 87,
  olxY: 20,
  otodomY: 80,
  hubY: 50,
  tierY: [16, 50, 84],
} as const;

function Node({
  label,
  value,
  unit,
  live,
  mark,
  accent = false,
  selected,
  liveTone = '',
  onToggle,
}: {
  label: string;
  value: string;
  unit?: string;
  live?: string;
  mark: MarkKind;
  accent?: boolean;
  selected?: boolean;
  liveTone?: string;
  onToggle?: () => void;
}) {
  const Tag = onToggle === undefined ? 'div' : 'button';

  return (
    <Tag
      {...(onToggle === undefined
        ? {}
        : { type: 'button' as const, onClick: onToggle, 'aria-pressed': selected })}
      className={`rule relative block w-full rounded-xl bg-graphite-900/90 px-4 py-3 text-left backdrop-blur-sm transition-colors duration-150 ${
        accent ? 'border-signal-500/45' : ''
      } ${onToggle === undefined ? '' : 'hover:border-line-strong'} ${
        selected === true ? 'border-signal-500/60' : ''
      }`}
    >
      {accent && (
        <div className="animate-drift pointer-events-none absolute -inset-4 -z-10 rounded-full bg-signal-500/12 blur-2xl" />
      )}
      <div className="tag flex items-center gap-1.5 whitespace-nowrap">
        <Mark kind={mark} />
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className={`num text-2xl leading-none font-medium ${accent ? 'lit-num' : 'text-ink'}`}
        >
          {value}
        </span>
        {unit !== undefined && <span className="num text-xs text-ink-faint">{unit}</span>}
      </div>
      {live !== undefined && <div className={`tag mt-1.5 normal-case ${liveTone}`}>{live}</div>}
    </Tag>
  );
}

/** Read-only. The verdict explains what the pipeline did; the filters decide what shows. */
export function PipelineGraph({
  counts,
  rulesVersion,
  sources,
}: {
  counts: PipelineCounts;
  rulesVersion: string;
  sources: SourceStatus[];
}) {
  const byName = (name: string) => sources.find((status) => status.source === name);
  const olxStatus = byName('olx');
  const otodomStatus = byName('otodom');
  const TIER_MARK: Record<Tier, MarkKind> = { top: 'pass', worth: 'partial', other: 'reject' };

  const tierNode = (tier: Tier, label: string, unit: string, accent = false) => (
    <Node
      label={label}
      value={String(counts.tiers[tier])}
      unit={unit}
      mark={TIER_MARK[tier]}
      accent={accent}
    />
  );

  const nodes = {
    olx: (
      <Node
        label="olx"
        value={String(counts.olx)}
        unit="ofert"
        live={sourceCaption(olxStatus, 'z łącza domowego')}
        liveTone={HEALTH_TONE[health(olxStatus)]}
        mark="feed"
      />
    ),
    otodom: (
      <Node
        label="otodom"
        value={String(counts.otodom)}
        unit="ofert"
        live={sourceCaption(otodomStatus, 'co 15 min, w chmurze')}
        liveTone={HEALTH_TONE[health(otodomStatus)]}
        mark="feed"
      />
    ),
    hub: (
      <Node
        label={`reguły ${rulesVersion}`}
        value={String(counts.total)}
        unit="ocenionych"
        mark="rules"
        accent
      />
    ),
    top: tierNode('top', 'w budżecie', 'całość ≤ 2600 zł', true),
    worth: tierNode('worth', 'tani najem', 'najem ≤ 2200, całość wyżej'),
    other: tierNode('other', 'odpada', 'poza kryteriami'),
  };

  return (
    <section aria-label="Przepływ danych" className="relative">
      {/* Desktop: a real graph. Connectors and nodes share the anchors above. */}
      <div className="relative hidden h-64 lg:block">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <filter id="diffuse" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            className="text-line-strong"
          >
            <line x1={AT.sourceX} y1={AT.olxY} x2={AT.hubX} y2={AT.hubY} />
            <line x1={AT.sourceX} y1={AT.otodomY} x2={AT.hubX} y2={AT.hubY} />
            {AT.tierY.map((y) => (
              <line key={y} x1={AT.hubX} y1={AT.hubY} x2={AT.tierX} y2={y} />
            ))}
          </g>

          {/* The two edges that carry the product's point, lit and moving. */}
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 22"
            vectorEffect="non-scaling-stroke"
            filter="url(#diffuse)"
            className="animate-trace text-signal-400"
          >
            <line x1={AT.sourceX} y1={AT.otodomY} x2={AT.hubX} y2={AT.hubY} />
            <line x1={AT.hubX} y1={AT.hubY} x2={AT.tierX} y2={AT.tierY[0]} />
          </g>
        </svg>

        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${AT.sourceX}%`, top: `${AT.olxY}%` }}
        >
          {nodes.olx}
        </div>
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${AT.sourceX}%`, top: `${AT.otodomY}%` }}
        >
          {nodes.otodom}
        </div>
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${AT.hubX}%`, top: `${AT.hubY}%` }}
        >
          {nodes.hub}
        </div>
        {(['top', 'worth', 'other'] as const).map((tier, index) => (
          <div
            key={tier}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${AT.tierX}%`, top: `${AT.tierY[index] ?? 50}%` }}
          >
            {nodes[tier]}
          </div>
        ))}
      </div>

      {/* Below lg the same chain reads down a rail rather than across a canvas. */}
      <ol className="relative grid gap-4 lg:hidden">
        {[nodes.olx, nodes.otodom, nodes.hub, nodes.top, nodes.worth, nodes.other].map(
          (node, index, all) => (
            <li key={index} className="relative">
              {index < all.length - 1 && (
                <span className="absolute top-full left-8 h-4 w-px bg-line" aria-hidden />
              )}
              {node}
            </li>
          ),
        )}
      </ol>
    </section>
  );
}
