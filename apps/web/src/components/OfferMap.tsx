import { divIcon } from 'leaflet';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import type { Offer } from '../types.ts';

const KRAKOW: [number, number] = [50.0614, 19.9372];

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
 * and a glance back at the list before it says anything.
 */
function priceMarker(offer: Offer, active: boolean, selected: boolean) {
  const top = offer.tier === 'top';
  const border = selected
    ? 'border-color:#fbbf24;box-shadow:0 0 0 3px rgba(251,191,36,.28)'
    : active
      ? 'border-color:#fbbf24'
      : top
        ? 'border-color:rgba(245,158,11,.55)'
        : 'border-color:#33333a';

  return divIcon({
    className: '',
    iconSize: [58, 24],
    iconAnchor: [29, 12],
    html: `<span style="
        display:flex;align-items:center;justify-content:center;gap:2px;
        width:58px;height:24px;border:1px solid;border-radius:9999px;
        background:${selected || active ? '#1c1917' : 'rgba(12,10,9,.92)'};
        font:500 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;
        color:${top ? '#fde68a' : '#d4d4d8'};letter-spacing:-.01em;${border}">
        ${isExact(offer) ? '' : '<span style="opacity:.5;font-size:9px">~</span>'}${shortPrice(offer.totalCostPln)}
      </span>`,
  });
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

/**
 * Refits only when the set of listings changes. Keyed on array identity it refitted on
 * every render, so hovering a card threw away whatever the user had just zoomed to.
 */
function Recentre({ points, fingerprint }: { points: [number, number][]; fingerprint: string }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    if (points.length > 1) map.fitBounds(points, { padding: [48, 48], maxZoom: 15 });
    else if (points.length === 1 && points[0] !== undefined) map.setView(points[0], 15);
    // Deliberately keyed on the fingerprint, not on points: the array is rebuilt every
    // render, and depending on it is what threw away the user's zoom.
  }, [fingerprint, map]);

  return null;
}

export function OfferMap({
  offers,
  activeId,
  selectedId,
  onHover,
  onSelect,
}: {
  offers: Offer[];
  activeId: number | null;
  selectedId: number | null;
  onHover: (id: number | null) => void;
  onSelect: (id: number) => void;
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
    <div className="rule h-full overflow-hidden rounded-xl">
      <MapContainer
        center={KRAKOW}
        zoom={12}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        attributionControl
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={20}
        />
        <FitToContainer />
        <Recentre points={points} fingerprint={fingerprint} />

        {located.map((offer) => (
          <Marker
            key={offer.id}
            position={[offer.lat as number, offer.lng as number]}
            icon={priceMarker(offer, offer.id === activeId, offer.id === selectedId)}
            // Price labels overlap downtown; the one being pointed at comes to the front.
            zIndexOffset={offer.id === selectedId ? 2000 : offer.id === activeId ? 1000 : 0}
            title={`${offer.title}${isExact(offer) ? '' : ' — przybliżona okolica'}`}
            eventHandlers={{
              mouseover: () => onHover(offer.id),
              mouseout: () => onHover(null),
              click: () => onSelect(offer.id),
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
