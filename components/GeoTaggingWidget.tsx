'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import { Input } from './Input';
import { Button } from './Button';
import { MapPin } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

const markerSvg = encodeURIComponent(`
  <svg width="32" height="48" viewBox="0 0 32 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="16" cy="16" rx="12" ry="12" fill="hsl(165,22%,26%)" stroke="hsl(217,91%,60%)" stroke-width="2"/>
    <ellipse cx="16" cy="16" rx="6" ry="6" fill="hsl(0,0%,98%)"/>
    <path d="M16 48C16 48 28 32 28 20C28 9.61116 22.0751 4 16 4C9.92487 4 4 9.61116 4 20C4 32 16 48 16 48Z" fill="hsl(165,22%,26%)" stroke="hsl(217,91%,60%)" stroke-width="2"/>
  </svg>
`);

const lucideMarkerIcon = () => {
  const svg = renderToStaticMarkup(
    <MapPin
      strokeWidth={2}
      width={32}
      height={32}
      color="#22524A"
      fill="#F7F7F7"
    />,
  );
  return L.divIcon({
    html: svg,
    className: 'leaflet-lucide-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

const DefaultIcon = lucideMarkerIcon();
L.Marker.prototype.options.icon = DefaultIcon;

interface GeoTaggingWidgetProps {
  value?: [number, number];
  onChange?: (coords: [number, number]) => void;
  defaultCenter?: [number, number];
  zoom?: number;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

function LocationMarker({
  value,
  onChange,
}: {
  value?: [number, number];
  onChange?: (coords: [number, number]) => void;
}) {
  useMapEvents({
    click(e) {
      onChange?.([e.latlng.lat, e.latlng.lng]);
    },
  });
  return value ? <Marker position={value} /> : null;
}

export const GeoTaggingWidget: React.FC<GeoTaggingWidgetProps> = ({
  value,
  onChange,
  defaultCenter = [48, 16],
  zoom = 4,
}) => {
  const [marker, setMarker] = useState<[number, number] | undefined>(value);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!search) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        search,
      )}`,
      { signal: controller.signal, headers: { 'Accept-Language': 'en' } },
    )
      .then((res) => res.json())
      .then((data) => setResults(data))
      .catch((e) => {
        if (e.name !== 'AbortError') setError('Search failed');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [search]);

  useEffect(() => {
    if (mapRef.current) {
      if (marker) {
        mapRef.current.setView(marker, zoom);
      } else if (results.length > 0) {
        const first = results[0];
        mapRef.current.setView(
          [parseFloat(first.lat), parseFloat(first.lon)],
          zoom,
        );
      }
    }
  }, [marker, results, zoom]);

  const handleChange = useCallback(
    (coords: [number, number]) => {
      setMarker(coords);
      onChange?.(coords);
    },
    [onChange],
  );

  const handleResultClick = (r: NominatimResult) => {
    const coords: [number, number] = [parseFloat(r.lat), parseFloat(r.lon)];
    setMarker(coords);
    onChange?.(coords);
    setResults([]);
    setSearch(r.display_name);
  };

  return (
    <div className="rounded shadow border bg-white p-2 w-full max-w-md">
      <div className="mb-2 flex gap-2 items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for a place..."
          className="flex-1"
        />
        <span className="text-gray-400 text-xs">
          {marker ? `${marker[1].toFixed(5)}, ${marker[0].toFixed(5)}` : ''}
        </span>
      </div>
      {loading && <div className="text-xs text-gray-400">Searching…</div>}
      {error && <div className="text-xs text-red-500">{error}</div>}
      {results.length > 0 && (
        <ul className="mb-2 max-h-40 overflow-auto border rounded bg-white text-xs z-10 relative">
          {results.map((r) => (
            <li
              key={r.place_id}
              className="p-2 hover:bg-blue-50 cursor-pointer border-b last:border-0"
              onClick={() => handleResultClick(r)}
            >
              {r.display_name}
            </li>
          ))}
        </ul>
      )}
      <div
        className="rounded overflow-hidden border mb-2"
        style={{ height: 220 }}
      >
        <MapContainer
          center={marker || defaultCenter}
          zoom={zoom}
          style={{ width: '100%', height: 220 }}
          scrollWheelZoom={true}
          ref={(mapInstance) => {
            if (mapInstance) {
              mapRef.current = mapInstance;
            }
          }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png"
          />
          {results.map((r: NominatimResult) => (
            <Marker
              key={r.place_id}
              position={
                [parseFloat(r.lat), parseFloat(r.lon)] as [number, number]
              }
              eventHandlers={
                {
                  click: () => handleResultClick(r),
                } as L.LeafletEventHandlerFnMap
              }
              icon={DefaultIcon}
            />
          ))}
          <LocationMarker value={marker} onChange={handleChange} />
        </MapContainer>
      </div>
      <div className="flex gap-2 mt-2">
        <Button variant="secondary">Cancel</Button>
        <Button variant="default">Ok</Button>
      </div>
    </div>
  );
};
