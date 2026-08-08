import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterBar } from './components/FilterBar.tsx';
import { OfferCard } from './components/OfferCard.tsx';
import { OfferMap } from './components/OfferMap.tsx';
import { RadarMark } from './components/RadarMark.tsx';
import { StatTile } from './components/StatTile.tsx';
import { applyFilters, availableDistricts, DEFAULT_FILTERS, type Filters } from './filters.ts';
import { since } from './format.ts';
import type { Offer } from './types.ts';

/** Long enough that the timer and the cloud round have moved on, short enough to feel live. */
const REFRESH_MS = 60_000;

type View = 'split' | 'list' | 'map';

export function App() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [view, setView] = useState<View>('split');

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/offers', signal ? { signal } : {});
    if (!response.ok) throw new Error(`API odpowiedziało ${response.status}`);

    const body = (await response.json()) as { offers: Offer[] };
    setOffers(body.offers);
    setFetchedAt(new Date().toISOString());
    setError(null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    load(controller.signal)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => setLoading(false));

    const timer = setInterval(() => void load().catch(() => undefined), REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);

  async function sync() {
    setSyncing(true);
    setSyncNote(null);

    try {
      const response = await fetch('/api/sync', { method: 'POST' });
      const body = (await response.json()) as { added?: number; error?: string };
      if (!response.ok) throw new Error(body.error ?? `API odpowiedziało ${response.status}`);

      await load();
      setSyncNote(body.added === 0 ? 'Brak nowych ofert' : `Nowe oferty: ${body.added}`);
    } catch (cause) {
      setSyncNote(cause instanceof Error ? cause.message : 'Synchronizacja nie powiodła się');
    } finally {
      setSyncing(false);
    }
  }

  const districts = useMemo(() => availableDistricts(offers), [offers]);
  const visible = useMemo(() => applyFilters(offers, filters), [offers, filters]);
  const counts = useMemo(
    () => ({
      top: offers.filter((offer) => offer.tier === 'top').length,
      worth: offers.filter((offer) => offer.tier === 'worth').length,
      mapped: visible.filter((offer) => offer.lat !== null).length,
    }),
    [offers, visible],
  );

  if (loading) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-4 text-stone-400">
          <RadarMark scanning />
          <p className="text-sm">Szukam mieszkań…</p>
        </div>
      </main>
    );
  }

  if (error !== null) {
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-950/30 p-6 text-center">
          <h1 className="text-lg font-semibold text-stone-100">Panel nie ma skąd wziąć danych</h1>
          <p className="mt-2 text-sm text-stone-400">
            Zwykle znaczy to, że nie działa API. Uruchom je w drugim terminalu:
          </p>
          <pre className="mt-3 rounded-lg bg-ash-950 px-3 py-2 text-sm text-ember-300">
            pnpm serve
          </pre>
          <p className="mt-3 text-xs text-stone-500">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-[110rem] px-4 pb-16 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center gap-4 py-6 sm:py-8">
        <RadarMark scanning={syncing} />
        <div className="mr-auto">
          <h1 className="text-xl font-semibold tracking-tight text-stone-50 sm:text-2xl">
            Flat<span className="text-ember-400">Radar</span>
          </h1>
          <p className="text-xs text-stone-500">Kraków · odświeżono {since(fetchedAt)}</p>
        </div>

        {syncNote !== null && (
          <span className="animate-rise rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-stone-300">
            {syncNote}
          </span>
        )}

        <button
          type="button"
          onClick={() => void sync()}
          disabled={syncing}
          className="group relative overflow-hidden rounded-full bg-gradient-to-r from-ember-500 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-ember-900/40 transition active:scale-95 disabled:opacity-60"
        >
          <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-500 group-hover:translate-x-0" />
          <span className="relative">{syncing ? 'Skanuję…' : 'Synchronizuj'}</span>
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="W budżecie" value={String(counts.top)} accent />
        <StatTile label="Tani najem" value={String(counts.worth)} />
        <StatTile label="Widoczne" value={`${visible.length}/${offers.length}`} />
        <StatTile label="Na mapie" value={String(counts.mapped)} />
      </div>

      <div className="mt-4">
        <FilterBar filters={filters} districts={districts} onChange={setFilters} />
      </div>

      <div className="mt-4 flex items-center gap-2 lg:hidden">
        {(['split', 'list', 'map'] as View[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setView(option)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              view === option
                ? 'border-ember-500/60 bg-ember-500/15 text-ember-200'
                : 'border-white/10 bg-white/5 text-stone-400'
            }`}
          >
            {option === 'split' ? 'Oba' : option === 'list' ? 'Lista' : 'Mapa'}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className={view === 'map' ? 'hidden lg:block' : ''}>
          {visible.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-ash-900/60 p-8 text-center text-sm text-stone-400">
              Nic nie pasuje do filtrów. Poluzuj koszt albo metraż.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((offer, index) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  index={index}
                  active={offer.id === activeId}
                  onHover={setActiveId}
                />
              ))}
            </div>
          )}
        </div>

        <div
          className={`lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)] ${
            view === 'list' ? 'hidden lg:block' : ''
          }`}
        >
          <OfferMap offers={visible} activeId={activeId} onHover={setActiveId} />
        </div>
      </div>
    </div>
  );
}
