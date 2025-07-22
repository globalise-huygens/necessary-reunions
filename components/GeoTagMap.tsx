'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import { useSession } from 'next-auth/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polygon,
  Popup,
  TileLayer,
  useMapEvents,
} from 'react-leaflet';
import { Button } from './Button';
import { Input } from './Input';
import { LoadingSpinner } from './LoadingSpinner';

// --- Icon Creation (No changes needed) ---
const createLucideMarkerIcon = () => {
  const { renderToStaticMarkup } = require('react-dom/server');
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
let DefaultIcon: L.DivIcon | null = null;
const getDefaultIcon = () => {
  if (!DefaultIcon) DefaultIcon = createLucideMarkerIcon();
  return DefaultIcon;
};

// --- Interfaces (No changes needed) ---
interface GeooTagMapProps {
  value?: [number, number];
  onChange?: (coords: [number, number]) => void;
  defaultCenter?: [number, number];
  zoom?: number;
  onGeotagSelected?: (geotag: {
    marker: [number, number];
    label: string;
    placeId: number;
    osmType: string;
    displayName: string;
    nominatimResult: NominatimResult;
  }) => void;
  initialGeotag?: {
    marker: [number, number];
    label: string;
    nominatimResult: NominatimResult;
  };
}
interface NominatimResult {
  display_name: string;
  osm_type: string;
  lat: string;
  lon: string;
  place_id: number;
}

// --- Helper Components (No changes needed) ---
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
  return value ? <Marker position={value} icon={getDefaultIcon()} /> : null;
}

// --- Main Component ---
export const GeoTagMap: React.FC<
  GeooTagMapProps & { expandedStyle?: boolean }
> = ({
  value,
  onChange,
  defaultCenter = [48, 16],
  zoom = 4,
  onGeotagSelected,
  expandedStyle = false,
  initialGeotag,
}) => {
  // IMPROVEMENT: Simplified state initialization using initialGeotag prop directly.
  const [marker, setMarker] = useState<[number, number] | undefined>(
    value || initialGeotag?.marker,
  );
  const [search, setSearch] = useState(initialGeotag?.label || '');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  const { data: session } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [selectedResult, setSelectedResult] = useState<NominatimResult | null>(
    initialGeotag?.nominatimResult || null,
  );
  const [polygons, setPolygons] = useState<{
    [placeId: number]: Array<Array<[number, number]>>;
  }>({});

  // IMPROVEMENT: A separate state for debouncing search input.
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  // IMPROVEMENT: Debounce effect to delay API calls.
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500); // Wait 500ms after user stops typing

    return () => {
      clearTimeout(timerId);
    };
  }, [search]);

  // This effect now uses the debounced search term
  useEffect(() => {
    if (
      !debouncedSearch ||
      (selectedResult && debouncedSearch === selectedResult.display_name)
    ) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    const controller = new AbortController();
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        debouncedSearch,
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
  }, [debouncedSearch, selectedResult]); // Depends on the debounced value

  // --- Other hooks and functions (mostly unchanged) ---

  const handleResultClick = (r: NominatimResult) => {
    const coords: [number, number] = [parseFloat(r.lat), parseFloat(r.lon)];
    setMarker(coords);
    onChange?.(coords);
    setResults([]);
    setSearch(r.display_name); // This will trigger the debounce logic correctly
    setSelectedResult(r);
  };

  const handleOk = () => {
    if (!marker || !selectedResult) {
      setSubmitError('Please select a place.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      onGeotagSelected?.({
        marker,
        label: selectedResult.display_name,
        placeId: selectedResult.place_id,
        osmType: selectedResult.osm_type,
        displayName: selectedResult.display_name,
        nominatimResult: selectedResult,
      });
      setSubmitSuccess(true);
    } catch (e: any) {
      setSubmitError(e.message || 'Failed to save geotag');
    } finally {
      setSubmitting(false);
    }
  };

  function normalizeCoords(coords: any): Array<Array<[number, number]>> {
    if (!Array.isArray(coords) || !coords[0] || !coords[0][0]) return [];
    // Nominatim returns [lon, lat], Leaflet needs [lat, lon], so we swap them.
    if (typeof coords[0][0] === 'number') {
      return [coords.map((pt: any) => [pt[1], pt[0]])];
    } else {
      return coords.map((poly: any) => poly.map((pt: any) => [pt[1], pt[0]]));
    }
  }

  // --- Polygon fetching logic (unchanged) ---
  useEffect(() => {
    const fetchPolygons = async () => {
      const newPolygons: { [placeId: number]: Array<Array<[number, number]>> } =
        {};
      await Promise.all(
        results.map(async (r) => {
          if (r.osm_type === 'relation' || r.osm_type === 'way') {
            try {
              const osmTypeLetter = r.osm_type.charAt(0).toUpperCase();
              const res = await fetch(
                `https://nominatim.openstreetmap.org/details.php?osmtype=${osmTypeLetter}&osmid=${r.place_id}&format=json&polygon_geojson=1`,
              );
              const data = await res.json();
              if (data?.geometry?.coordinates) {
                newPolygons[r.place_id] = normalizeCoords(
                  data.geometry.coordinates,
                );
              }
            } catch (e) {
              /* Silently fail */
            }
          }
        }),
      );
      setPolygons(newPolygons);
    };
    if (results.length > 0) fetchPolygons();
    else setPolygons({});
  }, [results]);

  // --- Map view adjustment hooks (unchanged) ---
  useEffect(() => {
    if (mapRef.current && marker) {
      mapRef.current.setView(marker, mapRef.current.getZoom());
    }
  }, [marker]);

  useEffect(() => {
    if (!mapRef.current || results.length === 0) return;
    const bounds = L.latLngBounds(
      results.map((r) => [parseFloat(r.lat), parseFloat(r.lon)]),
    );
    Object.values(polygons).forEach((polys) =>
      polys.forEach((poly) => bounds.extend(poly)),
    );
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [results, polygons]);

  // --- JSX Rendering (unchanged) ---
  return (
    <div
      className={
        expandedStyle
          ? 'rounded-lg border border-border bg-card shadow-sm p-3 w-full max-w-none'
          : 'rounded-lg border border-border bg-card shadow-sm p-3 w-full max-w-md'
      }
    >
      <div className="mb-3 flex gap-2 items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for a place..."
        />
        {loading && (
          <div className="p-2">
            <LoadingSpinner />
          </div>
        )}
      </div>

      {results.length > 0 && (
        <ul className="mb-3 max-h-32 overflow-auto border rounded-lg">
          {results.map((r) => (
            <li
              key={r.place_id}
              className="p-2 cursor-pointer border-b last:border-0 hover:bg-muted/50"
              onClick={() => handleResultClick(r)}
            >
              {r.display_name}
            </li>
          ))}
        </ul>
      )}

      <div
        className="rounded-lg overflow-hidden border mb-3"
        style={{ height: 180 }}
      >
        <MapContainer
          center={marker || defaultCenter}
          zoom={zoom}
          style={{ width: '100%', height: 180 }}
          scrollWheelZoom
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
          />
          {results.map((r) => (
            <Marker
              key={r.place_id}
              position={[parseFloat(r.lat), parseFloat(r.lon)]}
              eventHandlers={{ click: () => handleResultClick(r) }}
              icon={getDefaultIcon()}
            >
              <Popup>{r.display_name}</Popup>
            </Marker>
          ))}
          {Object.entries(polygons).map(([placeId, polys]) =>
            polys.map((poly, i) => (
              <Polygon
                key={`${placeId}-${i}`}
                positions={poly}
                pathOptions={{ color: '#3388ff', weight: 2, fillOpacity: 0.1 }}
              />
            )),
          )}
          <LocationMarker
            value={marker}
            onChange={(coords) => setMarker(coords)}
          />
        </MapContainer>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button
          variant="outline"
          onClick={() => {
            setMarker(undefined);
            setSearch('');
            setSelectedResult(null);
          }}
        >
          Clear
        </Button>
        <Button
          onClick={handleOk}
          disabled={submitting || !selectedResult || submitSuccess}
        >
          {submitSuccess ? 'Saved' : submitting ? 'Saving...' : 'Save'}
        </Button>
      </div>
      {submitError && (
        <div className="text-xs text-destructive mt-2">{submitError}</div>
      )}
    </div>
  );
};
