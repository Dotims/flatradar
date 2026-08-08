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
  const colour = offer.tier === 'top' ? '#fbbf24' : '#a1a1aa';
  const size = active ? 14 : 9;
  const glow = offer.tier === 'top' ? `box-shadow:0 0 12px 2px ${colour}80;` : '';

  return divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${colour};${glow}"></span>`,
  });
}

/** Leaflet measures the container on init, before the layout has given it a height. */
function FitToContainer() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const remeasure = () => map.invalidateSize();

    const observer = new ResizeObserver(remeasure);
    observer.observe(container);

    // Once for the current layout, once after the browser has finished it.
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

function Recentre({ offers }: { offers: Offer[] }) {
  const map = useMap();

  useEffect(() => {
    // Before fitting: a view fitted to a stale height leaves the lower rows untiled.
    map.invalidateSize();

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
                color: offer.tier === 'top' ? '#fbbf24' : '#71717a',
                weight: 1,
                fillOpacity: offer.id === activeId ? 0.28 : 0.1,
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
    </div>
  );
}
