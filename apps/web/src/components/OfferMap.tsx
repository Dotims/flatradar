import { divIcon } from 'leaflet';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { area, pln, rooms, since } from '../format.ts';
import type { Theme } from '../theme.ts';
import type { Mark, Offer, OfferDetail } from '../types.ts';
import { MarkControls } from './MarkControls.tsx';

const KRAKOW: [number, number] = [50.0614, 19.9372];

const TILES: Record<Theme, string> = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};

/** Otodom pins a real address; OLX reports an area centre and the marker says so. */
function isExact(offer: Offer): boolean {
  return offer.coordsPrecision === 'exact';
}

function shortPrice(value: number | null): string {
  if (value === null) return '?';
  return `${Math.round(value / 100) / 10}k`;
}

/**
 * The price is what the user compares, so the price is the marker. A dot forces a hover
 * and a glance back at the list before it says anything. Colours come from the theme
 * tokens rather than literals, because this markup is built by hand and would otherwise
 * stay dark on a white map.
 */
function priceMarker(offer: Offer, active: boolean, selected: boolean) {
  const top = offer.tier === 'top';
  const border = selected
    ? 'border-color:var(--color-signal-400);box-shadow:0 0 0 3px color-mix(in srgb, var(--color-signal-400) 28%, transparent)'
    : active
      ? 'border-color:var(--color-signal-400)'
      : top
        ? 'border-color:color-mix(in srgb, var(--color-signal-400) 55%, transparent)'
        : 'border-color:var(--color-line-strong)';

  return divIcon({
    className: '',
    iconSize: [58, 24],
    iconAnchor: [29, 12],
    html: `<span style="
        display:flex;align-items:center;justify-content:center;gap:2px;
        width:58px;height:24px;border:1px solid;border-radius:9999px;
        background:${selected || active ? 'var(--color-graphite-800)' : 'color-mix(in srgb, var(--color-graphite-950) 92%, transparent)'};
        font:500 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;
        color:${top ? 'var(--color-signal-300)' : 'var(--color-ink-dim)'};letter-spacing:-.01em;${border}">
        ${isExact(offer) ? '' : '<span style="opacity:.5;font-size:9px">~</span>'}${shortPrice(offer.totalCostPln)}
      </span>`,
  });
}

/** A quiet stand-in for a listing whose price label had no room to be drawn. */
function dotMarker(offer: Offer, active: boolean, selected: boolean) {
  const lit = active || selected || offer.tier === 'top';

  return divIcon({
    className: '',
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    html: `<span style="
      display:block;width:10px;height:10px;border-radius:9999px;
      border:1px solid ${lit ? 'var(--color-signal-400)' : 'var(--color-line-strong)'};
      background:${lit ? 'color-mix(in srgb, var(--color-signal-500) 45%, transparent)' : 'var(--color-graphite-800)'};
    "></span>`,
  });
}

const LABEL_W = 62;
const LABEL_H = 28;

/**
 * Which listings get to show their price. Every label at once turns the centre into a
 * pile of overlapping pills, so the cheapest claims its space first and anything that
 * would land on top of an accepted label falls back to a dot. Zooming in frees room and
 * more prices appear, which is also how the portals do it.
 *
 * Projected at the current zoom rather than to screen coordinates, so panning does not
 * reshuffle the labels underneath the cursor.
 */
function useLabelled(offers: Offer[], keep: (number | null)[]): Set<number> {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const update = () => setZoom(map.getZoom());
    map.on('zoomend', update);
    return () => {
      map.off('zoomend', update);
    };
  }, [map]);

  return useMemo(() => {
    const ordered = [...offers].sort((a, b) => {
      const forced = (offer: Offer) => (keep.includes(offer.id) ? 0 : 1);
      if (forced(a) !== forced(b)) return forced(a) - forced(b);
      return (a.totalCostPln ?? Infinity) - (b.totalCostPln ?? Infinity);
    });

    const taken: { x: number; y: number }[] = [];
    const labelled = new Set<number>();

    for (const offer of ordered) {
      const point = map.project([offer.lat as number, offer.lng as number], zoom);
      const clear = taken.every(
        (other) => Math.abs(other.x - point.x) >= LABEL_W || Math.abs(other.y - point.y) >= LABEL_H,
      );

      if (clear) {
        taken.push({ x: point.x, y: point.y });
        labelled.add(offer.id);
      }
    }

    return labelled;
  }, [offers, keep, map, zoom]);
}

/** Leaflet measures the container on init, before the layout has given it a height. */
function FitToContainer() {
  const map = useMap();

  useEffect(() => {
    const remeasure = () => map.invalidateSize();
    const observer = new ResizeObserver(remeasure);
    observer.observe(map.getContainer());

    remeasure();
    const frame = requestAnimationFrame(remeasure);
    const settle = setTimeout(remeasure, 300);
    window.addEventListener('resize', remeasure);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      window.removeEventListener('resize', remeasure);
    };
  }, [map]);

  return null;
}

/** Portal searches for Kraków return the odd listing in Wieliczka or Skawina. */
const OUTLIER_TRIM = 0.03;
const TRIM_NEEDS_AT_LEAST = 20;

function at(sorted: number[], fraction: number): number {
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round(fraction * (sorted.length - 1))),
  );
  return sorted[index] as number;
}

/**
 * The area worth looking at, which is not the same as the area covering every pin. A
 * single advert outside the city pulled the view out until Kraków was a smudge and no
 * price label had room, so the far edges are trimmed and can be reached by zooming out.
 */
function coreBounds(points: [number, number][]): [[number, number], [number, number]] {
  const lats = points.map(([lat]) => lat).sort((a, b) => a - b);
  const lngs = points.map(([, lng]) => lng).sort((a, b) => a - b);
  if (points.length < TRIM_NEEDS_AT_LEAST) {
    return [
      [at(lats, 0), at(lngs, 0)],
      [at(lats, 1), at(lngs, 1)],
    ];
  }

  return [
    [at(lats, OUTLIER_TRIM), at(lngs, OUTLIER_TRIM)],
    [at(lats, 1 - OUTLIER_TRIM), at(lngs, 1 - OUTLIER_TRIM)],
  ];
}

/**
 * Refits only when the set of listings changes. Keyed on array identity it refitted on
 * every render, so hovering a card threw away whatever the user had just zoomed to.
 */
function Recentre({ points, fingerprint }: { points: [number, number][]; fingerprint: string }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    if (points.length > 1) map.fitBounds(coreBounds(points), { padding: [40, 40], maxZoom: 15 });
    else if (points.length === 1 && points[0] !== undefined) map.setView(points[0], 15);
    // Deliberately keyed on the fingerprint, not on points: the array is rebuilt every
    // render, and depending on it is what threw away the user's zoom.
  }, [fingerprint, map]);

  return null;
}

/**
 * The preview a pin opens. Everything except the photograph is already in hand, so the
 * request is made only once this is on screen, and only for the one listing.
 */
function PopupBody({
  offer,
  open,
  onMark,
}: {
  offer: Offer;
  open: boolean;
  onMark: (next: Mark | null) => void;
}) {
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    fetch(`/api/offers/${offer.id}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<OfferDetail>) : null))
      .then((detail) => setPhoto(detail?.photos[0] ?? null))
      .catch(() => undefined);

    return () => controller.abort();
  }, [offer.id, open]);

  return (
    <a
      href={offer.url}
      target="_blank"
      rel="noreferrer noopener"
      className="block w-64 no-underline"
    >
      {photo !== null && (
        <img
          src={photo}
          alt=""
          className="mb-2.5 aspect-[4/3] w-full rounded-lg bg-graphite-900 object-cover"
        />
      )}

      <div className="flex items-baseline justify-between gap-2">
        <span className={`num text-lg ${offer.tier === 'top' ? 'text-signal-300' : 'text-ink'}`}>
          {pln(offer.totalCostPln)}
        </span>
        <span className="num text-sm text-ink-dim">{area(offer.areaM2)}</span>
      </div>

      <p className="mt-1 line-clamp-2 text-xs leading-snug text-ink-dim">{offer.title}</p>

      <div className="tag mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{offer.district ?? 'bez dzielnicy'}</span>
        <span className="text-ink-mute">·</span>
        <span>{rooms(offer.rooms)}</span>
        <span className="text-ink-mute">·</span>
        <span>{since(offer.createdAtSource)}</span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="tag text-signal-400">otwórz na {offer.source} ↗</span>
        <MarkControls mark={offer.mark} onChange={onMark} />
      </div>
    </a>
  );
}

function Pins({
  located,
  activeId,
  selectedId,
  onHover,
  onMark,
}: {
  located: Offer[];
  activeId: number | null;
  selectedId: number | null;
  onHover: (id: number | null) => void;
  onMark: (id: number, next: Mark | null) => void;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const keep = useMemo(() => [activeId, selectedId, openId], [activeId, selectedId, openId]);
  const labelled = useLabelled(located, keep);

  return (
    <>
      {located.map((offer) => {
        const active = offer.id === activeId;
        const selected = offer.id === selectedId;
        const showPrice = labelled.has(offer.id);

        return (
          <Marker
            key={offer.id}
            position={[offer.lat as number, offer.lng as number]}
            icon={
              showPrice ? priceMarker(offer, active, selected) : dotMarker(offer, active, selected)
            }
            // Labels still touch at the edges; the one being pointed at comes to the front.
            zIndexOffset={selected ? 2000 : active ? 1000 : showPrice ? 500 : 0}
            title={`${offer.title}${isExact(offer) ? '' : ' — przybliżona okolica'}`}
            // No click handler: the pin opens its own preview and nothing else. Wiring
            // selection here as well opened the side panel on top of the popup.
            eventHandlers={{
              mouseover: () => onHover(offer.id),
              mouseout: () => onHover(null),
              popupopen: () => setOpenId(offer.id),
              popupclose: () => setOpenId((current) => (current === offer.id ? null : current)),
            }}
          >
            <Popup autoPan closeButton minWidth={256} maxWidth={256}>
              <PopupBody
                offer={offer}
                open={openId === offer.id}
                onMark={(next) => onMark(offer.id, next)}
              />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export function OfferMap({
  offers,
  activeId,
  selectedId,
  theme,
  onHover,
  onMark,
}: {
  offers: Offer[];
  activeId: number | null;
  selectedId: number | null;
  theme: Theme;
  onHover: (id: number | null) => void;
  onMark: (id: number, next: Mark | null) => void;
}) {
  const located = useMemo(
    () => offers.filter((offer) => offer.lat !== null && offer.lng !== null),
    [offers],
  );

  const fingerprint = useMemo(() => located.map((offer) => offer.id).join(','), [located]);

  const points = useMemo(
    () => located.map((offer) => [offer.lat as number, offer.lng as number] as [number, number]),
    [located],
  );

  return (
    // No border or radius of its own: the map fills a column now, and the column draws
    // the one line between it and the listings.
    <div className="h-full overflow-hidden">
      <MapContainer
        center={KRAKOW}
        zoom={12}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        attributionControl
      >
        <TileLayer
          key={theme}
          url={TILES[theme]}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={20}
        />
        <FitToContainer />
        <Recentre points={points} fingerprint={fingerprint} />
        <Pins
          located={located}
          activeId={activeId}
          selectedId={selectedId}
          onHover={onHover}
          onMark={onMark}
        />
      </MapContainer>
    </div>
  );
}
