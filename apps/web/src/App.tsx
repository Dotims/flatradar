import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterBar } from './components/FilterBar.tsx';
import { OfferCard } from './components/OfferCard.tsx';
import { OfferDetail } from './components/OfferDetail.tsx';
import { OfferMap } from './components/OfferMap.tsx';
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
import { useMarks, withMarks } from './marks.ts';
import { useTheme } from './theme.ts';
import type { Offer, SortKey, SourceStatus, Tier } from './types.ts';

/*
  THESIS: a flat search is a pipeline with a verdict at the end, so the surface opens on
  the pipeline itself rather than the dashboard's usual row of stat tiles.
  OWN-WORLD: true black ground, graphite panels, 1px lines, no shadows; one warm
  yellow-orange accent that lights only what is decided; monospace on every number,
  parameter and tag, sans for prose. Light is the same world with the values swapped.
  STORY: the visitor sets the bounds, reads the listings that survive them, then checks
  where they are.
  FIRST VIEWPORT: freshness and the bounds in one bar, then the whole of the rest of the
  screen split between the listings and the map, both readable without scrolling to them.
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

/**
 * Tailwind's `lg`, restated here because this is a behavioural decision rather than a
 * stylistic one: below it the map is not on screen to be flown to, so it has to be
 * opened before a card can hand it anything.
 */
const SIDE_BY_SIDE = '(min-width: 64rem)';

type SyncNote = { kind: 'ok' | 'error'; text: string };

/**
 * Stand-ins while the first response is in flight. The whole set arrives in one 2.7MB
 * body, which is a second or two on a normal connection, and the page used to spend that
 * time as a centred word on an empty screen. The frame is up immediately instead: the
 * bounds are usable before the listings land, and nothing moves when they do.
 */
function OfferSkeleton() {
  return (
    <ul className="grid list-none gap-3">
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index} className="rule h-44 animate-drift rounded-xl bg-graphite-950" />
      ))}
    </ul>
  );
}

export function App() {
  const [collected, setCollected] = useState<Offer[]>([]);
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
  const { theme, toggle: toggleTheme } = useTheme();

  /**
   * Kept in this browser rather than the database, because the page is shared. One
   * visitor's rejection must not take a flat off everybody else's list.
   */
  const { marks, setMark } = useMarks();
  const offers = useMemo(() => withMarks(collected, marks), [collected, marks]);

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/offers', signal ? { signal } : {});
    if (!response.ok) throw new Error(`API odpowiedziało ${response.status}`);

    const body = (await response.json()) as { offers: Offer[]; sources?: SourceStatus[] };
    setCollected(body.offers);
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

  /**
   * Picking a listing points the map at it instead of opening a panel over the page. The
   * map already carries the photograph, the price and the marks, so the panel was a
   * second copy of the card covering the one view that could say something new.
   */
  function selectOffer(offer: Offer) {
    setSelectedId(offer.id);
    if (offer.lat !== null && !window.matchMedia(SIDE_BY_SIDE).matches) setMapOpen(true);
  }

  /**
   * The panel survives for the listings the map cannot answer for. Neither portal gives
   * coordinates for every advert, and 1911 of 4284 currently have none, so routing every
   * click to the map would leave close to half the list doing nothing when clicked.
   */
  const detail =
    selected !== null && (selected.lat === null || selected.lng === null) ? selected : null;

  const located = useMemo(() => visible.filter((offer) => offer.lat !== null).length, [visible]);

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

  const map = (
    <OfferMap
      offers={visible}
      activeId={activeId}
      selectedId={selectedId}
      theme={theme}
      onHover={setActiveId}
      onMark={setMark}
    />
  );

  /*
    An application frame rather than a document: the page itself never scrolls, the
    listings scroll inside their own column, and the map holds the other column at full
    height. Before this the chrome above the fold was 425px of a 1000px screen, so the
    map opened as a 576px slice of itself and reading it meant scrolling the listings
    away first.
  */
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* z-30 so the district panel opens over the map, which is the next thing down. */}
      <div className="relative z-30 shrink-0 border-b border-line px-5 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 pt-4 pb-3.5">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-xl font-semibold tracking-tight">
              Flat<span className="lit">Radar</span>
            </h1>
            <p className="tag normal-case">
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

        {loading ? (
          // Same box, without a count. Rendering the real strip here would have it
          // announce "0 ofert w bazie" for as long as the request takes.
          <div className="rule flex items-center rounded-xl bg-graphite-950 px-4 py-3">
            <span className="tag animate-drift">wczytuję oferty</span>
          </div>
        ) : (
          <StatusStrip
            counts={counts}
            sources={sources}
            expanded={graphOpen}
            onToggleExpanded={() => setGraphOpen((open) => !open)}
          />
        )}

        {graphOpen && (
          // Capped: the frame below cannot scroll away, so an unbounded panel here would
          // push the listings and the map off the bottom of the screen.
          <div className="mt-4 max-h-[45dvh] overflow-x-clip overflow-y-auto">
            <PipelineGraph counts={counts} rulesVersion="v4" sources={sources} />
          </div>
        )}

        <div className="mt-4 pb-4">
          <FilterBar
            filters={filters}
            districts={districts}
            favourites={marked.favourites}
            rejected={marked.rejected}
            onChange={setFilters}
          />
        </div>
      </div>

      <main className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(28rem,50%)]">
        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-2.5 sm:px-8 lg:pr-6 lg:pl-10">
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
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-8 lg:pr-6 lg:pl-10">
            {loading ? (
              <OfferSkeleton />
            ) : error !== null ? (
              <div className="rule max-w-md rounded-xl bg-graphite-950 p-6">
                <h2 className="text-base font-medium text-ink">Panel nie ma skąd wziąć danych</h2>
                <p className="mt-2 text-sm text-ink-dim">
                  Zwykle znaczy to, że nie działa API. Uruchom je w drugim terminalu:
                </p>
                <pre className="rule mt-3 rounded-lg bg-graphite-900 px-3 py-2 font-mono text-sm text-signal-300">
                  pnpm serve
                </pre>
                <p className="tag mt-3 normal-case">{error}</p>
              </div>
            ) : visible.length === 0 ? (
              <p className="rule rounded-xl bg-graphite-950 p-10 text-center text-sm text-ink-dim">
                {offers.length === 0
                  ? 'Baza jest pusta. Uruchom zbieranie: pnpm collect.'
                  : `Żadna z ${offers.length} ofert nie pasuje do filtrów.`}
                {activeFilterHint !== null && (
                  <span className="mt-2 block text-ink-faint">{activeFilterHint}</span>
                )}
              </p>
            ) : (
              // One card per row. Two of them fit across the old full-width list, but
              // this column is half the screen now and the pair clipped the source tags
              // and broke every title onto three lines.
              <ul className="grid list-none gap-3">
                {visible.map((offer) => (
                  <li key={offer.id}>
                    <OfferCard
                      offer={offer}
                      active={offer.id === activeId}
                      selected={offer.id === selectedId}
                      onHover={setActiveId}
                      onSelect={() => selectOffer(offer)}
                      onMark={(next) => setMark(offer.id, next)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Flush to the edge and to the full height of the frame: this column is the map
            and nothing else. Listings the portal never placed are not shown beside it any
            more; they are in the list like every other listing. */}
        {/* isolate, and not decoration: Leaflet gives its panes z-index 400 and the old
            layout happened to contain them, because it sat in a sticky wrapper and
            position:sticky always opens a stacking context. Without one here those 400s
            reach the root and outrank the district panel and the detail overlay, which
            then open underneath the map. */}
        <div className="hidden isolate border-l border-line lg:block">{map}</div>
      </main>

      {/* One column wide there is no room to show both, so the map is a full screen the
          listings are swapped for, rather than a panel that pushes them down. */}
      <button
        type="button"
        onClick={() => setMapOpen(true)}
        className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-gradient-to-r from-signal-400 to-signal-600 px-5 py-2.5 font-mono text-[0.6875rem] tracking-[0.08em] text-on-signal uppercase shadow-lg shadow-black/30 lg:hidden"
      >
        mapa · {located}
      </button>

      {mapOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-void lg:hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
            <span className="tag">mapa · {located}</span>
            <button
              type="button"
              onClick={() => setMapOpen(false)}
              className="tag rounded-full border border-line px-3 py-1.5 normal-case transition-colors hover:border-line-strong hover:text-ink-dim"
            >
              zamknij
            </button>
          </div>
          <div className="min-h-0 flex-1">{map}</div>
        </div>
      )}

      {/* The fallback for a listing with no pin, not the usual way in. An overlay rather
          than a third column: the map was shrunk by exactly this kind of neighbour. */}
      {detail !== null && (
        <>
          <button
            type="button"
            aria-label="Zamknij szczegóły"
            onClick={() => setSelectedId(null)}
            className="fixed inset-0 z-40 bg-scrim/60 backdrop-blur-[2px]"
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md p-3 sm:p-4">
            <OfferDetail
              offer={detail}
              onClose={() => setSelectedId(null)}
              onMark={(next) => setMark(detail.id, next)}
            />
          </div>
        </>
      )}
    </div>
  );
}
