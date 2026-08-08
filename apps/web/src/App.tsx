import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterRail } from './components/FilterRail.tsx';
import { OfferCard } from './components/OfferCard.tsx';
import { OfferMap } from './components/OfferMap.tsx';
import { PipelineGraph } from './components/PipelineGraph.tsx';
import { StatusStrip } from './components/StatusStrip.tsx';
import { applyFilters, availableDistricts, DEFAULT_FILTERS, type Filters } from './filters.ts';
import { minutesSince, since } from './format.ts';
import type { Offer, SourceStatus, Tier } from './types.ts';

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

/** A background poll may fail quietly once; two in a row means the API is gone. */
const FAILURES_BEFORE_DISCONNECTED = 2;

type SyncNote = { kind: 'ok' | 'error'; text: string };

export function App() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<SyncNote | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [graphOpen, setGraphOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const toggleTier = useCallback(
    (tier: Tier) =>
      setFilters((current) => ({
        ...current,
        tiers: current.tiers.includes(tier)
          ? current.tiers.filter((item) => item !== tier)
          : [...current.tiers, tier],
      })),
    [],
  );

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/offers', signal ? { signal } : {});
    if (!response.ok) throw new Error(`API odpowiedziało ${response.status}`);

    const body = (await response.json()) as { offers: Offer[]; sources?: SourceStatus[] };
    setOffers(body.offers);
    setSources(body.sources ?? []);
    setError(null);
    setDisconnected(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    load(controller.signal)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => setLoading(false));

    // A swallowed poll failure used to leave the header claiming freshness forever.
    let consecutiveFailures = 0;
    const timer = setInterval(() => {
      void load()
        .then(() => {
          consecutiveFailures = 0;
        })
        .catch(() => {
          consecutiveFailures++;
          if (consecutiveFailures >= FAILURES_BEFORE_DISCONNECTED) setDisconnected(true);
        });
    }, REFRESH_MS);

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
      setSyncNote({
        kind: 'ok',
        text: body.added === 0 ? 'bez nowych ofert' : `nowe oferty: ${body.added}`,
      });
    } catch (cause) {
      setSyncNote({
        kind: 'error',
        text: cause instanceof Error ? cause.message : 'synchronizacja nie powiodła się',
      });
    } finally {
      setSyncing(false);
    }
  }

  /**
   * The header reports the feed that ran longest ago, because the page is only as
   * current as its stalest source. A failed round counts as no round.
   */
  const oldestFeed = useMemo(() => {
    const usable = sources.filter(
      (status) => status.ok !== false && status.lastCollectedAt !== null,
    );
    if (usable.length === 0) return { label: 'nieznany', stale: true };

    const oldest = usable.reduce((worst, status) =>
      (minutesSince(status.lastCollectedAt) ?? 0) > (minutesSince(worst.lastCollectedAt) ?? 0)
        ? status
        : worst,
    );

    return {
      label: since(oldest.lastCollectedAt),
      stale: (minutesSince(oldest.lastCollectedAt) ?? 0) > 40,
    };
  }, [sources]);

  const districts = useMemo(() => availableDistricts(offers), [offers]);
  const visible = useMemo(() => applyFilters(offers, filters), [offers, filters]);

  /** Names the filter actually responsible, rather than the two easiest to mention. */
  const activeFilterHint = useMemo(() => {
    const narrowed: string[] = [];
    if (filters.districts.length > 0) narrowed.push(`dzielnice (${filters.districts.length})`);
    if (filters.privateOnly) narrowed.push('tylko prywatne');
    if (filters.minAreaM2 > 0) narrowed.push(`metraż od ${filters.minAreaM2} m²`);
    if (filters.tiers.length < 3) narrowed.push('ocena');
    narrowed.push(`koszt do ${filters.maxCostPln} zł`);

    return narrowed.length === 0 ? null : `Zawężają: ${narrowed.join(', ')}.`;
  }, [filters]);

  const withoutLocation = useMemo(
    () => visible.filter((offer) => offer.lat === null).length,
    [visible],
  );

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
          <p className="tag mt-1 normal-case">
            Kraków ·{' '}
            {disconnected ? (
              <span className="text-red-400">brak połączenia z API</span>
            ) : (
              <span className={oldestFeed.stale ? 'text-amber-400' : ''}>
                najstarszy zbiór {oldestFeed.label}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {syncNote !== null && (
            <span
              role="status"
              className={`tag normal-case ${syncNote.kind === 'error' ? 'text-red-400' : ''}`}
            >
              {syncNote.text}
            </span>
          )}
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

      <StatusStrip
        counts={counts}
        sources={sources}
        selectedTiers={filters.tiers}
        onToggleTier={toggleTier}
        expanded={graphOpen}
        onToggleExpanded={() => setGraphOpen((open) => !open)}
      />

      {graphOpen && (
        <div className="mt-6 overflow-x-clip">
          <PipelineGraph
            counts={counts}
            rulesVersion="v3"
            sources={sources}
            selectedTiers={filters.tiers}
            onToggleTier={toggleTier}
          />
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-10 2xl:grid-cols-[minmax(0,1fr)_26rem_15rem]">
        <div className="min-w-0 lg:order-1">
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <h2 className="text-sm font-medium text-ink-dim">Oferty</h2>
            <span aria-live="polite" className="num text-xs text-ink-faint">
              {visible.length} / {offers.length}
              {withoutLocation > 0 && (
                <span className="ml-2 text-ink-faint">· {withoutLocation} bez lokalizacji</span>
              )}
            </span>
          </div>

          {visible.length === 0 ? (
            <p className="rule mt-6 rounded-xl bg-graphite-950 p-10 text-center text-sm text-ink-dim">
              {offers.length === 0
                ? 'Baza jest pusta. Uruchom zbieranie: pnpm collect.'
                : `Żadna z ${offers.length} ofert nie pasuje do filtrów.`}
              {activeFilterHint !== null && (
                <span className="mt-2 block text-ink-faint">{activeFilterHint}</span>
              )}
            </p>
          ) : (
            <ul className="mt-6 grid list-none gap-3 xl:grid-cols-2">
              {visible.map((offer) => (
                <li key={offer.id}>
                  <OfferCard offer={offer} active={offer.id === activeId} onHover={setActiveId} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Wide enough for a third column: the map sits beside the list, tall rather
            than letterboxed, and both stay visible while hovering links them. */}
        <div className="hidden 2xl:order-2 2xl:block">
          <div className="sticky top-6 h-[calc(100dvh-3rem)]">
            <OfferMap offers={visible} activeId={activeId} onHover={setActiveId} />
          </div>
        </div>

        <aside className="lg:order-3 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <FilterRail filters={filters} districts={districts} onChange={setFilters} />

          {/* Below the third-column breakpoint the map is a panel, closed by default,
              so it never pushes the listings past the fold. */}
          <div className="mt-8 2xl:hidden">
            <button
              type="button"
              onClick={() => setMapOpen((open) => !open)}
              aria-expanded={mapOpen}
              className="tag normal-case transition-colors hover:text-ink-dim"
            >
              {mapOpen ? 'ukryj mapę' : `pokaż mapę · ${visible.length - withoutLocation}`}
            </button>
            {mapOpen && (
              <div className="mt-3 h-80">
                <OfferMap offers={visible} activeId={activeId} onHover={setActiveId} />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
