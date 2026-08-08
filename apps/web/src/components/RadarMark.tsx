/** The logo, and the loading state: the sweep speeds up while a sync is running. */
export function RadarMark({ scanning = false }: { scanning?: boolean }) {
  return (
    <span className="relative grid size-10 shrink-0 place-items-center">
      <svg viewBox="0 0 40 40" className="size-10" aria-hidden="true">
        <defs>
          <linearGradient id="radar-sweep" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-ember-400)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--color-ember-400)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="20" cy="20" r="18" className="fill-ash-900 stroke-ember-700/50" />
        <circle cx="20" cy="20" r="12" className="fill-none stroke-ember-700/35" />
        <circle cx="20" cy="20" r="6" className="fill-none stroke-ember-700/25" />
        <g
          className="origin-center animate-sweep"
          style={scanning ? { animationDuration: '0.9s' } : undefined}
        >
          <path d="M20 20 L20 2 A18 18 0 0 1 36 12 Z" fill="url(#radar-sweep)" />
        </g>
        <circle cx="27" cy="14" r="2" className="fill-ember-300 animate-ping-slow origin-center" />
        <circle cx="27" cy="14" r="1.6" className="fill-ember-200" />
      </svg>
    </span>
  );
}
