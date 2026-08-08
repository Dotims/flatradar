export function StatTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 backdrop-blur transition-colors ${
        accent
          ? 'border-ember-600/50 bg-ember-600/10'
          : 'border-white/10 bg-white/5 hover:border-white/20'
      }`}
    >
      <div className="text-[0.7rem] font-medium tracking-wide text-stone-400 uppercase">
        {label}
      </div>
      <div
        className={`mt-0.5 text-2xl font-semibold tabular-nums ${
          accent ? 'text-ember-300' : 'text-stone-100'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
