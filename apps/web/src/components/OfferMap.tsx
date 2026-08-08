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
  const colour = offer.tier === 'top' ? '#ea580c' : '#d97706';
  const size = active ? 16 : 11;

  return divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${colour};border:2px solid #fff"></span>`,
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
    <div style={{ position: 'relative', height: '100%', minHeight: '20rem' }}>
      <MapContainer
        center={KRAKOW}
        zoom={12}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        attributionControl
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
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
    </div>
  );
}
