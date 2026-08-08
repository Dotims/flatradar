import { divIcon } from 'leaflet';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';

import type { Offer } from '../types.ts';

const KRAKOW: [number, number] = [50.0614, 19.9372];

/** Otodom gives a real address; OLX reports an area centre, drawn as a circle instead. */
function isExact(offer: Offer): boolean {
  return offer.coordsPrecision === 'exact';
}

function pin(offer: Offer, active: boolean) {
  const ring = active ? 'ring-4 ring-ember-400/50' : '';
  const tone = offer.tier === 'top' ? 'bg-ember-500' : 'bg-amber-400';

  return divIcon({
    className: '',
    iconSize: [0, 0],
    html: `<span class="relative -ml-3 -mt-3 grid size-6 place-items-center">
      ${offer.tier === 'top' ? `<span class="absolute inline-flex size-6 rounded-full ${tone} opacity-60 animate-ping-slow"></span>` : ''}
      <span class="relative inline-flex size-3.5 rounded-full ${tone} ${ring} shadow-lg"></span>
    </span>`,
  });
}

/** Leaflet measures the container on init, before the layout has given it a height. */
function FitToContainer() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    map.invalidateSize();

    return () => observer.disconnect();
  }, [map]);

  return null;
}

function Recentre({ offers }: { offers: Offer[] }) {
  const map = useMap();

  useEffect(() => {
    const points = offers
      .filter((offer) => offer.lat !== null && offer.lng !== null)
      .map((offer) => [offer.lat as number, offer.lng as number] as [number, number]);

    if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
    else if (points.length === 1 && points[0] !== undefined) map.setView(points[0], 14);
  }, [offers, map]);

  return null;
}

export function OfferMap({
  offers,
  activeId,
  onHover,
}: {
  offers: Offer[];
  activeId: number | null;
  onHover: (id: number | null) => void;
}) {
  const located = offers.filter((offer) => offer.lat !== null && offer.lng !== null);

  return (
    <div className="relative h-full min-h-[22rem] overflow-hidden rounded-2xl border border-white/10">
      <MapContainer
        center={KRAKOW}
        zoom={12}
        scrollWheelZoom
        className="h-full w-full"
        attributionControl
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={20}
        />
        <FitToContainer />
        <Recentre offers={located} />

        {located.map((offer) =>
          isExact(offer) ? (
            <Marker
              key={offer.id}
              position={[offer.lat as number, offer.lng as number]}
              icon={pin(offer, offer.id === activeId)}
              eventHandlers={{
                mouseover: () => onHover(offer.id),
                mouseout: () => onHover(null),
                click: () => window.open(offer.url, '_blank', 'noopener'),
              }}
            />
          ) : (
            <CircleMarker
              key={offer.id}
              center={[offer.lat as number, offer.lng as number]}
              radius={offer.id === activeId ? 16 : 11}
              pathOptions={{
                color: offer.tier === 'top' ? '#fb923c' : '#fbbf24',
                weight: 1.5,
                fillOpacity: offer.id === activeId ? 0.35 : 0.15,
              }}
              eventHandlers={{
                mouseover: () => onHover(offer.id),
                mouseout: () => onHover(null),
                click: () => window.open(offer.url, '_blank', 'noopener'),
              }}
            />
          ),
        )}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex flex-col gap-1 rounded-xl border border-white/10 bg-ash-950/85 px-3 py-2 text-[0.7rem] text-stone-300 backdrop-blur">
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-ember-500" /> dokładny adres (Otodom)
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full border border-amber-400/70 bg-amber-400/20" />{' '}
          przybliżony obszar (OLX)
        </span>
      </div>
    </div>
  );
}
