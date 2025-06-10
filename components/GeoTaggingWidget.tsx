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
import { v4 as uuidv4 } from 'uuid';
import { Input } from './Input';
import { Button } from './Button';
import { MapPin } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoadingSpinner } from './LoadingSpinner';

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
  return value ? <Marker position={value} icon={DefaultIcon} /> : null;
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
          ? 'rounded border bg-white p-1 w-full max-w-none'
          : 'rounded border bg-white p-1 w-full max-w-md'
      }
    >
      <div className="mb-1 flex gap-1 items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for a place..."
          className={`flex-1 text-sm px-2 py-1 ${
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
          <span className="ml-1">
            <LoadingSpinner />
          </span>
        )}
      </div>

      {marker &&
        (!selectedResult || search !== selectedResult.display_name) &&
        results.length > 0 && (
          <div className="text-gray-400 text-xs mb-1 text-right">
            {marker[1].toFixed(5)}, {marker[0].toFixed(5)}
          </div>
        )}

      {error && <div className="text-xs text-red-500">{error}</div>}
      {!loading &&
        search &&
        results.length === 0 &&
        !error &&
        (!selectedResult || search !== selectedResult.display_name) && (
          <div className="text-xs text-gray-500 mb-1">
            No results found for your search.
          </div>
        )}

      {results.length > 0 && (
        <ul className="mb-1 max-h-32 overflow-auto border rounded bg-white text-xs z-10">
          {results.map((r) => (
            <li
              key={r.place_id}
              className={`p-1 cursor-pointer border-b last:border-0 hover:bg-blue-50 ${
                selectedResult && selectedResult.place_id === r.place_id
                  ? 'bg-blue-100 text-blue-900 font-semibold'
                  : ''
              }`}
              onClick={() => handleResultClick(r)}
            >
              {r.display_name}
            </li>
          ))}
        </ul>
      )}

      <div
        className="rounded overflow-hidden border mb-1"
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
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {results.map((r) => (
            <Marker
              key={r.place_id}
              position={[parseFloat(r.lat), parseFloat(r.lon)]}
              eventHandlers={{
                click: () => handleResultClick(r),
              }}
              icon={DefaultIcon}
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
      <div className="flex justify-end gap-1 mt-1">
        <Button
          variant="outline"
          className="flex-1 py-0.5 px-2 text-xs min-h-0 h-7"
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
          className={`w-full py-0.5 px-2 text-xs font-semibold min-h-0 h-7 flex items-center justify-center ${
            submitSuccess
              ? 'bg-green-100 text-green-800 border-green-400 cursor-default'
              : ''
          }`}
        >
          {submitSuccess ? (
            <>
              <svg
                className="inline mr-1"
                width="16"
                height="16"
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
        <div className="text-xs text-red-500 mt-1">{submitError}</div>
      )}
      {submitSuccess && (
        <div className="text-xs text-green-500 mt-1">Geotag saved!</div>
      )}
    </div>
  );
};
