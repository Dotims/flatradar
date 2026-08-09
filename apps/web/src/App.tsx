import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterBar } from './components/FilterBar.tsx';
import { OfferCard } from './components/OfferCard.tsx';
import { OfferDetail } from './components/OfferDetail.tsx';
import { OfferMap } from './components/OfferMap.tsx';
import { UnlocatedPanel } from './components/UnlocatedPanel.tsx';
import { PipelineGraph } from './components/PipelineGraph.tsx';
import { StatusStrip } from './components/StatusStrip.tsx';
import {
  applyFilters,
  availableDistricts,
  DEFAULT_FILTERS,
  SORTS,
  sortOffers,
  type Filters,
} from './filters.ts';
import { minutesSince, since } from './format.ts';
import { useTheme } from './theme.ts';
import type { Mark, Offer, SortKey, SourceStatus, Tier } from './types.ts';

/*
  THESIS: a flat search is a pipeline with a verdict at the end, so the surface opens on
  the pipeline itself rather than the dashboard's usual row of stat tiles.
  OWN-WORLD: true black ground, graphite panels, 1px lines, no shadows; one warm
  yellow-orange accent that lights only what is decided; monospace on every number,
  parameter and tag, sans for prose. Light is the same world with the values swapped.
  STORY: the visitor sets the bounds, reads the listings that survive them, then checks
  where they are.
  FIRST VIEWPORT: freshness, the bounds, then listings on the left and the map on the
  right, wide enough to read at a glance.
  FORM: node-graph pipeline, pinned by the brief, folded away by default.
  FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
  review, the verdict, and DESIGN.md
*/

/**
 * Collection runs every fifteen minutes, so polling every minute asked for the same
 * answer fourteen times over. It matters more now the list is thousands of rows rather
 * than the few hundred it was written for. The sync button covers wanting it sooner.
 */
const REFRESH_MS = 300_000;

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
  const [sort, setSort] = useState<SortKey>('newest');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();

  /**
   * Applied locally first. The write is one row and the list is thousands, so refetching
   * to learn what we already know would make marking a flat feel like a page load.
   */
  const mark = useCallback((id: number, next: Mark | null) => {
    setOffers((current) =>
      current.map((offer) => (offer.id === id ? { ...offer, mark: next } : offer)),
    );

    void fetch(`/api/offers/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark: next }),
    }).then((response) => {
      if (!response.ok) setMarkError('Nie udało się zapisać. Odśwież stronę.');
    });
  }, []);

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
  const visible = useMemo(
    () => sortOffers(applyFilters(offers, filters), sort),
    [offers, filters, sort],
  );

  const selected = useMemo(
    () => visible.find((offer) => offer.id === selectedId) ?? null,
    [visible, selectedId],
  );

  const unlocated = useMemo(() => visible.filter((offer) => offer.lat === null), [visible]);

  /** Names the bound actually responsible, rather than the two easiest to mention. */
  const activeFilterHint = useMemo(() => {
    const narrowed: string[] = [];
    const range = (label: string, from: number | null, to: number | null, unit: string) => {
      if (from === null && to === null) return;
      if (from !== null && to !== null) narrowed.push(`${label} ${from}-${to} ${unit}`);
      else if (from !== null) narrowed.push(`${label} od ${from} ${unit}`);
      else narrowed.push(`${label} do ${String(to)} ${unit}`);
    };

    range('koszt', filters.minCostPln, filters.maxCostPln, 'zł');
    range('metraż', filters.minAreaM2, filters.maxAreaM2, 'm²');
    range('pokoje', filters.minRooms, filters.maxRooms, '');
    if (filters.privateOnly) narrowed.push('tylko prywatne');
    if (filters.hiddenDistricts.length > 0) {
      narrowed.push(`${filters.hiddenDistricts.length} ukrytych dzielnic`);
    }

    return narrowed.length === 0 ? null : `Zawężają: ${narrowed.join(', ')}.`;
  }, [filters]);

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

  const marked = useMemo(
    () => ({
      favourites: offers.filter((offer) => offer.mark === 'favourite').length,
      rejected: offers.filter((offer) => offer.mark === 'rejected').length,
    }),
    [offers],
  );

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
          <pre className="rule mt-3 rounded-lg bg-graphite-900 px-3 py-2 font-mono text-sm text-signal-300">
            pnpm serve
          </pre>
          <p className="tag mt-3 normal-case">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-[110rem] px-5 pb-24 sm:px-8 lg:px-12">
      <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-8 lg:py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Flat<span className="lit">Radar</span>
          </h1>
          <p className="tag mt-1 normal-case">
            Kraków ·{' '}
            {disconnected ? (
              <span className="text-danger">brak połączenia z API</span>
            ) : (
              <span className={oldestFeed.stale ? 'text-signal-300' : ''}>
                najstarszy zbiór {oldestFeed.label}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {markError !== null && (
            <span role="status" className="tag text-danger normal-case">
              {markError}
            </span>
          )}
          {syncNote !== null && (
            <span
              role="status"
              className={`tag normal-case ${syncNote.kind === 'error' ? 'text-danger' : ''}`}
            >
              {syncNote.text}
            </span>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'}
            className="tag rounded-full border border-line px-3 py-1.5 normal-case transition-colors hover:border-line-strong hover:text-ink-dim"
          >
            {theme === 'dark' ? 'jasny' : 'ciemny'}
          </button>
          <button
            type="button"
            onClick={() => void sync()}
            disabled={syncing}
            className="rounded-full bg-gradient-to-r from-signal-400 to-signal-600 px-5 py-2 font-mono text-[0.6875rem] tracking-[0.08em] text-on-signal uppercase transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
          >
            {syncing ? 'skanuję…' : 'synchronizuj'}
          </button>
        </div>
      </header>

      <StatusStrip
        counts={counts}
        sources={sources}
        expanded={graphOpen}
        onToggleExpanded={() => setGraphOpen((open) => !open)}
      />

      {graphOpen && (
        <div className="mt-6 overflow-x-clip">
          <PipelineGraph counts={counts} rulesVersion="v4" sources={sources} />
        </div>
      )}

      <div className="mt-6">
        <FilterBar
          filters={filters}
          districts={districts}
          favourites={marked.favourites}
          rejected={marked.rejected}
          onChange={setFilters}
        />
      </div>

      {/* Two columns once there is room: listings to read, map to place them. The bounds
          moved to the bar above so the map keeps a column it can actually be read in. */}
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,42%)] lg:gap-10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-line pb-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
              <h2 className="text-sm font-medium text-ink-dim">Oferty</h2>
              <div className="flex flex-wrap gap-1.5">
                {SORTS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSort(key)}
                    aria-pressed={sort === key}
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[0.6875rem] tracking-[0.06em] uppercase transition-colors ${
                      sort === key
                        ? 'border-signal-400/60 bg-signal-500/10 text-signal-300'
                        : 'border-line text-ink-faint hover:border-line-strong hover:text-ink-dim'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <span aria-live="polite" className="num text-xs text-ink-faint">
              {visible.length} / {offers.length}
              {unlocated.length > 0 && (
                <span className="ml-2 text-ink-faint">· {unlocated.length} bez lokalizacji</span>
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
            <ul className="mt-6 grid list-none gap-3 2xl:grid-cols-2">
              {visible.map((offer) => (
                <li key={offer.id}>
                  <OfferCard
                    offer={offer}
                    active={offer.id === activeId}
                    selected={offer.id === selectedId}
                    onHover={setActiveId}
                    onSelect={() => setSelectedId(offer.id)}
                    onMark={(next) => mark(offer.id, next)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-6 flex h-[calc(100dvh-3rem)] flex-col gap-3">
            <div className="min-h-0 flex-1">
              <OfferMap
                offers={visible}
                activeId={activeId}
                selectedId={selectedId}
                theme={theme}
                onHover={setActiveId}
                onMark={mark}
              />
            </div>
            <UnlocatedPanel
              offers={unlocated}
              activeId={activeId}
              onHover={setActiveId}
              onSelect={setSelectedId}
            />
          </div>
        </div>
      </div>

      {/* Below the two-column breakpoint the map is a panel, closed by default, so it
          never pushes the listings past the fold. */}
      <div className="mt-8 lg:hidden">
        <button
          type="button"
          onClick={() => setMapOpen((open) => !open)}
          aria-expanded={mapOpen}
          className="tag normal-case transition-colors hover:text-ink-dim"
        >
          {mapOpen ? 'ukryj mapę' : `pokaż mapę · ${visible.length - unlocated.length}`}
        </button>
        {mapOpen && (
          <div className="mt-3 grid gap-3">
            <div className="h-96">
              <OfferMap
                offers={visible}
                activeId={activeId}
                selectedId={selectedId}
                theme={theme}
                onHover={setActiveId}
                onMark={mark}
              />
            </div>
            <UnlocatedPanel
              offers={unlocated}
              activeId={activeId}
              onHover={setActiveId}
              onSelect={setSelectedId}
            />
          </div>
        )}
      </div>

      {/* Opened from a listing card. An overlay rather than a third column: the map was
          shrunk by exactly this kind of neighbour. */}
      {selected !== null && (
        <>
          <button
            type="button"
            aria-label="Zamknij szczegóły"
            onClick={() => setSelectedId(null)}
            className="fixed inset-0 z-40 bg-scrim/60 backdrop-blur-[2px]"
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md p-3 sm:p-4">
            <OfferDetail
              offer={selected}
              onClose={() => setSelectedId(null)}
              onMark={(next) => mark(selected.id, next)}
            />
          </div>
        </>
      )}
    </div>
  );
}
