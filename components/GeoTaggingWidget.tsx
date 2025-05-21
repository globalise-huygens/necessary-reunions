'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { Input } from './Input';

const DefaultIcon = L.icon({
  iconUrl: iconUrl.src,
  shadowUrl: iconShadow.src,
  iconAnchor: [12, 41],
});
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

  // Center map on marker or first result
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
        <button
          className="px-3 py-1 rounded bg-gray-100 text-gray-700 border"
          type="button"
        >
          Cancel
        </button>
        <button
          className="px-3 py-1 rounded bg-blue-600 text-white"
          type="button"
        >
          Ok
        </button>
      </div>
    </div>
  );
};
