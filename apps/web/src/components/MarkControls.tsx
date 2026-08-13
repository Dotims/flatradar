import type { Mark } from '../types.ts';

/** 1px strokes, no fills, the way every system mark on the page is drawn. */
function Glyph({ kind, filled }: { kind: 'keep' | 'drop'; filled: boolean }) {
  const paths = {
    keep: 'M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z',
    drop: 'M4 4l8 8M12 4l-8 8',
  } as const;

  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" aria-hidden="true">
      <path
        d={paths[kind]}
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="square"
      />
    </svg>
  );
}

function Toggle({
  on,
  label,
  kind,
  onClick,
}: {
  on: boolean;
  label: string;
  kind: 'keep' | 'drop';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={(event) => {
        // These sit inside a card that opens the panel and inside a popup that opens
        // the portal; neither should happen because a mark was set.
        event.stopPropagation();
        event.preventDefault();
        onClick();
      }}
      className={`grid size-7 place-items-center rounded-full border transition-colors duration-150 ${
        on
          ? 'border-signal-400/60 bg-signal-500/10 text-signal-300'
          : 'border-line text-ink-mute hover:border-line-strong hover:text-ink-dim'
      }`}
    >
      <Glyph kind={kind} filled={on} />
    </button>
  );
}

/**
 * The owner's own verdict on a listing. Clicking the mark already set clears it, so
 * ruling a flat out by accident costs one click to undo rather than a hunt through a
 * settings screen.
 */
export function MarkControls({
  mark,
  onChange,
}: {
  mark: Mark | null;
  onChange: (next: Mark | null) => void;
}) {
  const set = (next: Mark) => onChange(mark === next ? null : next);

  return (
    <div className="flex items-center gap-1.5">
      <Toggle
        on={mark === 'favourite'}
        kind="keep"
        label={mark === 'favourite' ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
        onClick={() => set('favourite')}
      />
      <Toggle
        on={mark === 'rejected'}
        kind="drop"
        label={mark === 'rejected' ? 'Przywróć ofertę' : 'Wyklucz ofertę'}
        onClick={() => set('rejected')}
      />
    </div>
  );
}
