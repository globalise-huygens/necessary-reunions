'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  Polygon,
  Popup,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useSession } from 'next-auth/react';
import { Input } from './Input';
import { Button } from './Button';
import { MapPin } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

// Create icon function that's called on demand rather than at module level
const createLucideMarkerIcon = () => {
  // Only import renderToStaticMarkup when actually needed
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

// Default icon will be created lazily
let DefaultIcon: L.DivIcon | null = null;

const getDefaultIcon = () => {
  if (!DefaultIcon) {
    DefaultIcon = createLucideMarkerIcon();
  }
  return DefaultIcon;
};
interface GeoTaggingWidgetProps {
  value?: [number, number];
  onChange?: (coords: [number, number]) => void;
  defaultCenter?: [number, number];
  zoom?: number;
  target: string;
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

interface SessionUser {
  id: string;
  label: string;
}
interface SessionData {
  user: SessionUser;
  accessToken: string;
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
  return value ? <Marker position={value} icon={getDefaultIcon()} /> : null;
}

export const GeoTaggingWidget: React.FC<
  GeoTaggingWidgetProps & { expandedStyle?: boolean }
> = ({
  value,
  onChange,
  defaultCenter = [48, 16],
  zoom = 4,
  target,
  onGeotagSelected,
  expandedStyle = false,
  initialGeotag,
}) => {
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

  function normalizeCoords(coords: any): Array<Array<[number, number]>> {
    if (!Array.isArray(coords)) return [];
    if (typeof coords[0][0] === 'number') {
      return [coords.map((pt: any) => [pt[1], pt[0]])];
    } else {
      return coords.map((poly: any) => poly.map((pt: any) => [pt[1], pt[0]]));
    }
  }

  useEffect(() => {
    if (initialGeotag && initialGeotag.label) {
      setMarker(initialGeotag.marker);
      setSearch(initialGeotag.label);
      setSelectedResult(initialGeotag.nominatimResult);
      setResults([]);
    }
  }, [initialGeotag]);

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

  useEffect(() => {
    if (!mapRef.current) return;
    if (results.length > 0) {
      let bounds: [number, number][] = results.map((r) => [
        parseFloat(r.lat),
        parseFloat(r.lon),
      ]);
      Object.values(polygons).forEach((polys) => {
        polys.forEach((poly) => {
          bounds = bounds.concat(poly);
        });
      });
      if (bounds.length > 1) {
        mapRef.current.fitBounds(bounds as L.LatLngBoundsExpression, {
          padding: [20, 20],
        });
      } else if (bounds.length === 1) {
        mapRef.current.setView(bounds[0], zoom);
      }
    }
  }, [results, polygons, zoom]);

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
    setSelectedResult(r);
  };

  const handleOk = () => {
    setSubmitError(null);
    setSubmitSuccess(false);
    if (!marker || !selectedResult) {
      setSubmitError('Please select a place.');
      return;
    }
    setSubmitting(true);
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
                `https://nominatim.openstreetmap.org/details.php?osmtype=${osmTypeLetter}&osmid=${r.place_id}&format=json`,
              );
              const data = await res.json();
              if (data && data.geometry && data.geometry.coordinates) {
                newPolygons[r.place_id] = normalizeCoords(
                  data.geometry.coordinates,
                );
              }
            } catch (e) {}
          }
        }),
      );
      setPolygons(newPolygons);
    };
    if (results.length > 0) fetchPolygons();
    else setPolygons({});
  }, [results]);

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
          className={`flex-1 text-sm ${
            selectedResult && search === selectedResult.display_name
              ? 'h-auto min-h-[2.5rem] max-h-20 whitespace-pre-line break-words'
              : ''
          }`}
          style={
            selectedResult && search === selectedResult.display_name
              ? {
                  height: 'auto',
                  minHeight: '2.5rem',
                  maxHeight: '5rem',
                  whiteSpace: 'pre-line',
                  overflowY: 'auto',
                }
              : {}
          }
        />
        {loading && (
          <div className="p-2">
            <LoadingSpinner />
          </div>
        )}
      </div>

      {marker &&
        (!selectedResult || search !== selectedResult.display_name) &&
        results.length > 0 && (
          <div className="text-muted-foreground text-xs mb-2 text-right bg-muted/30 p-2 rounded">
            Coordinates: {marker[1].toFixed(5)}, {marker[0].toFixed(5)}
          </div>
        )}

      {error && (
        <div className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
          {error}
        </div>
      )}
      {!loading &&
        search &&
        results.length === 0 &&
        !error &&
        (!selectedResult || search !== selectedResult.display_name) && (
          <div className="text-xs text-muted-foreground mb-2 p-2 bg-muted/30 rounded border border-dashed">
            No results found for your search.
          </div>
        )}

      {results.length > 0 && (
        <ul className="mb-3 max-h-32 overflow-auto border border-border rounded-lg bg-card text-xs shadow-sm">
          {results.map((r) => (
            <li
              key={r.place_id}
              className={`p-2 cursor-pointer border-b border-border last:border-0 hover:bg-muted/50 transition-colors ${
                selectedResult && selectedResult.place_id === r.place_id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground'
              }`}
              onClick={() => handleResultClick(r)}
            >
              {r.display_name}
            </li>
          ))}
        </ul>
      )}

      <div
        className="rounded-lg overflow-hidden border border-border mb-3 shadow-sm"
        style={{ height: 180 }}
      >
        <MapContainer
          center={marker || defaultCenter}
          zoom={zoom}
          style={{ width: '100%', height: 180 }}
          scrollWheelZoom
          ref={(map) => {
            if (map) mapRef.current = map;
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {results.map((r) => (
            <Marker
              key={r.place_id}
              position={[parseFloat(r.lat), parseFloat(r.lon)]}
              eventHandlers={{
                click: () => handleResultClick(r),
              }}
              icon={getDefaultIcon()}
            >
              <Popup>{r.display_name}</Popup>
            </Marker>
          ))}
          {Object.entries(polygons).map(([placeId, polys]) =>
            polys.map((poly, i) => (
              <Polygon
                key={placeId + '-' + i}
                positions={poly}
                pathOptions={{
                  color:
                    selectedResult &&
                    selectedResult.place_id === Number(placeId)
                      ? '#22524A'
                      : '#3388ff',
                  weight: 2,
                  fillOpacity: 0.1,
                }}
                eventHandlers={{
                  click: () => {
                    const r = results.find(
                      (r) => r.place_id === Number(placeId),
                    );
                    if (r) handleResultClick(r);
                  },
                }}
              />
            )),
          )}
          {!results.some(
            (r) =>
              marker &&
              parseFloat(r.lat) === marker[0] &&
              parseFloat(r.lon) === marker[1],
          ) && <LocationMarker value={marker} onChange={handleChange} />}
        </MapContainer>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button
          variant="outline"
          className="flex-1 text-sm"
          onClick={() => {
            setMarker(undefined);
            setSearch('');
            setResults([]);
            setSelectedResult(null);
            setSubmitSuccess(false);
          }}
          disabled={submitting}
        >
          Clear
        </Button>
        <Button
          variant={submitSuccess ? 'secondary' : 'default'}
          onClick={handleOk}
          disabled={submitting || !session || submitSuccess}
          className={`w-full text-sm flex items-center justify-center gap-2 ${
            submitSuccess
              ? 'bg-secondary/20 text-secondary border-secondary/30 cursor-default'
              : ''
          }`}
        >
          {submitSuccess ? (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </>
          ) : submitting ? (
            'Saving…'
          ) : (
            'Save'
          )}
        </Button>
      </div>
      {submitError && (
        <div className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 mt-2 flex items-center gap-2">
          <svg
            className="w-3 h-3 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {submitError}
        </div>
      )}
      {submitSuccess && (
        <div className="text-xs text-emerald-600 bg-emerald-50 p-2 rounded border border-emerald-200 mt-2 flex items-center gap-2">
          <svg
            className="w-3 h-3 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Geotag saved!
        </div>
      )}
    </div>
  );
};
