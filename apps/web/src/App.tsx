import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterRail } from './components/FilterRail.tsx';
import { OfferCard } from './components/OfferCard.tsx';
import { OfferMap } from './components/OfferMap.tsx';
import { PipelineGraph } from './components/PipelineGraph.tsx';
import { applyFilters, availableDistricts, DEFAULT_FILTERS, type Filters } from './filters.ts';
import { since } from './format.ts';
import type { Offer, Tier } from './types.ts';

/*
  THESIS: a flat search is a pipeline with a verdict at the end, so the surface opens on
  the pipeline itself rather than the dashboard's usual row of stat tiles.
  OWN-WORLD: true black ground, graphite panels, 1px lines, no shadows; one warm
  yellow-orange accent that lights only what is decided; monospace on every number,
  parameter and tag, sans for prose.
  STORY: the visitor sees where listings come from and what happened to them, reads the
  ones that survived, then checks where they are.
  FIRST VIEWPORT: the graph across the top, sources left, rules lit in the middle, tiers
  right; the sync action sits in the masthead beside the freshness stamp.
  FORM: node-graph pipeline, pinned by the brief, no roll run.
  FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
  review, the verdict, and DESIGN.md
*/

const REFRESH_MS = 60_000;

export function App() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [activeId, setActiveId] = useState<number | null>(null);

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
      setSyncNote(body.added === 0 ? 'bez nowych' : `nowe: ${body.added}`);
    } catch (cause) {
      setSyncNote(cause instanceof Error ? cause.message : 'synchronizacja nie powiodła się');
    } finally {
      setSyncing(false);
    }
  }

  const districts = useMemo(() => availableDistricts(offers), [offers]);
  const visible = useMemo(() => applyFilters(offers, filters), [offers, filters]);

  const counts = useMemo(() => {
    const tiers: Record<Tier, number> = { top: 0, worth: 0, other: 0 };
    for (const offer of offers) tiers[offer.tier]++;

    return {
      olx: offers.filter((offer) => offer.source === 'olx').length,
      otodom: offers.filter((offer) => offer.source === 'otodom').length,
      total: offers.length,
      tiers,
    };
  }, [offers]);

  if (loading) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <p className="tag animate-drift">skanuję</p>
      </main>
    );
  }

  if (error !== null) {
    return (
      <main className="grid min-h-dvh place-items-center px-6">
        <div className="rule max-w-md rounded-xl bg-graphite-950 p-6">
          <h1 className="text-lg font-medium text-ink">Panel nie ma skąd wziąć danych</h1>
          <p className="mt-2 text-sm text-ink-dim">
            Zwykle znaczy to, że nie działa API. Uruchom je w drugim terminalu:
          </p>
          <pre className="rule mt-3 rounded-lg bg-void px-3 py-2 font-mono text-sm text-signal-300">
            pnpm serve
          </pre>
          <p className="tag mt-3 normal-case">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-[100rem] px-5 pb-24 sm:px-8 lg:px-12">
      <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-8 lg:py-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Flat<span className="lit">Radar</span>
          </h1>
          <p className="tag mt-1 normal-case">Kraków · odczyt {since(fetchedAt)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {syncNote !== null && <span className="tag normal-case">{syncNote}</span>}
          <button
            type="button"
            onClick={() => void sync()}
            disabled={syncing}
            className="rounded-full bg-gradient-to-r from-signal-400 to-signal-600 px-5 py-2 font-mono text-[0.6875rem] tracking-[0.08em] text-void uppercase transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
          >
            {syncing ? 'skanuję…' : 'synchronizuj'}
          </button>
        </div>
      </header>

      <PipelineGraph
        counts={counts}
        rulesVersion="v3"
        selectedTiers={filters.tiers}
        onToggleTier={(tier) =>
          setFilters({
            ...filters,
            tiers: filters.tiers.includes(tier)
              ? filters.tiers.filter((item) => item !== tier)
              : [...filters.tiers, tier],
          })
        }
      />

      <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <FilterRail filters={filters} districts={districts} onChange={setFilters} />
        </aside>

        <div className="min-w-0">
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <h2 className="text-sm font-medium text-ink-dim">Oferty</h2>
            <span className="num text-xs text-ink-faint">
              {visible.length} / {offers.length}
            </span>
          </div>

          <div className="mt-6 h-72 sm:h-96">
            <OfferMap offers={visible} activeId={activeId} onHover={setActiveId} />
          </div>

          {visible.length === 0 ? (
            <p className="rule mt-6 rounded-xl bg-graphite-950 p-10 text-center text-sm text-ink-dim">
              Nic nie pasuje do filtrów. Poluzuj koszt albo metraż.
            </p>
          ) : (
            <div className="mt-6 grid gap-3 xl:grid-cols-2">
              {visible.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  active={offer.id === activeId}
                  onHover={setActiveId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
