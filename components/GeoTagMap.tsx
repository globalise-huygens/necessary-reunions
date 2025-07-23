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

const createLucideMarkerIcon = () => {
  if (typeof window === 'undefined') return null;

  try {
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
  } catch (error) {
    console.warn('Error creating Lucide marker icon:', error);
    return null;
  }
};

let DefaultIcon: L.DivIcon | null = null;
const getDefaultIcon = () => {
  if (typeof window === 'undefined') return null;
  if (!DefaultIcon) {
    DefaultIcon = createLucideMarkerIcon();
  }
  return DefaultIcon;
};

interface GeooTagMapProps {
  value?: [number, number];
  onChange?: (coords: [number, number]) => void;
  defaultCenter?: [number, number];
  zoom?: number;
  onGeotagSelected?: (geotag: {
    marker: [number, number];
    label: string;
    placeId: string;
    source: 'nominatim' | 'globalise';
    displayName: string;
    originalResult: NominatimResult | GlobaliseResult;
  }) => void;
  initialGeotag?: {
    marker: [number, number];
    label: string;
    originalResult: NominatimResult | GlobaliseResult;
  };
}
interface NominatimResult {
  display_name: string;
  osm_type: string;
  lat: string;
  lon: string;
  place_id: number;
}

interface GlobaliseResult {
  id: string;
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
  properties: {
    title: string;
    description: string;
    preferredTitle?: string;
    allLabels?: string[];
    originalTitle?: string;
  };
}

interface SearchResult {
  id: string;
  displayName: string;
  coordinates: [number, number] | null;
  source: 'nominatim' | 'globalise';
  originalData: NominatimResult | GlobaliseResult;
}

type SearchSource = 'both' | 'globalise' | 'nominatim';

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
  const icon = getDefaultIcon();
  return value && icon ? <Marker position={value} icon={icon} /> : null;
}

const createSearchResultFromInitial = (
  initialGeotag: GeooTagMapProps['initialGeotag'],
): SearchResult | null => {
  if (!initialGeotag?.originalResult) return null;

  const result = initialGeotag.originalResult;

  if ('geometry' in result && 'properties' in result) {
    return {
      id: result.id,
      displayName: result.properties.preferredTitle || result.properties.title,
      coordinates: result.geometry?.coordinates
        ? ([result.geometry.coordinates[1], result.geometry.coordinates[0]] as [
            number,
            number,
          ])
        : null,
      source: 'globalise',
      originalData: result,
    };
  }

  if ('lat' in result && 'lon' in result && 'display_name' in result) {
    return {
      id: String(result.place_id),
      displayName: result.display_name,
      coordinates: [parseFloat(result.lat), parseFloat(result.lon)] as [
        number,
        number,
      ],
      source: 'nominatim',
      originalData: result,
    };
  }

  return null;
};

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
  const [marker, setMarker] = useState<[number, number] | undefined>(
    value || initialGeotag?.marker,
  );
  const [search, setSearch] = useState(initialGeotag?.label || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  const { data: session } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(
    createSearchResultFromInitial(initialGeotag),
  );
  const [polygons, setPolygons] = useState<{
    [placeId: string]: Array<Array<[number, number]>>;
  }>({});

  const [globaliseAvailable, setGlobaliseAvailable] = useState(true);
  const [searchSource, setSearchSource] = useState<SearchSource>('both');

  const [mapKey] = useState(() => `map-${Date.now()}-${Math.random()}`);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);

    return () => {
      clearTimeout(timerId);
    };
  }, [search]);

  useEffect(() => {
    if (
      !debouncedSearch ||
      (selectedResult && debouncedSearch === selectedResult.displayName)
    ) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    const controller = new AbortController();

    const searchBothAPIs = async () => {
      try {
        const allResults: SearchResult[] = [];

        if (searchSource === 'both' || searchSource === 'globalise') {
          try {
            const globaliseResponse = await fetch(
              `/api/globalise/places?name=${encodeURIComponent(
                debouncedSearch,
              )}`,
              { signal: controller.signal },
            );

            if (globaliseResponse.ok) {
              const globaliseData = await globaliseResponse.json();
              if (
                globaliseData.features &&
                Array.isArray(globaliseData.features)
              ) {
                const globaliseResults: SearchResult[] =
                  globaliseData.features.map((feature: GlobaliseResult) => ({
                    id: feature.id,
                    displayName:
                      feature.properties.preferredTitle ||
                      feature.properties.title,
                    coordinates: feature.geometry?.coordinates
                      ? ([
                          feature.geometry.coordinates[1],
                          feature.geometry.coordinates[0],
                        ] as [number, number])
                      : null,
                    source: 'globalise' as const,
                    originalData: feature,
                  }));
                allResults.push(...globaliseResults);

                if (globaliseResults.length > 0) {
                  setGlobaliseAvailable(true);
                }
              }
            } else {
              console.warn(
                `GLOBALISE API returned ${globaliseResponse.status}: ${globaliseResponse.statusText}`,
              );
              if (globaliseResponse.status === 403) {
                setGlobaliseAvailable(false);
                console.warn(
                  'GLOBALISE API access forbidden - authentication required',
                );
              }
            }
          } catch (e) {
            if (e instanceof Error && e.name !== 'AbortError') {
              console.warn('GLOBALISE API search failed:', e);
            }
          }
        }

        if (searchSource === 'both' || searchSource === 'nominatim') {
          try {
            const nominatimResponse = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                debouncedSearch,
              )}`,
              {
                signal: controller.signal,
                headers: { 'Accept-Language': 'en' },
              },
            );

            if (nominatimResponse.ok) {
              const nominatimData = await nominatimResponse.json();
              if (Array.isArray(nominatimData)) {
                const nominatimResults: SearchResult[] = nominatimData.map(
                  (result: NominatimResult) => ({
                    id: String(result.place_id),
                    displayName: result.display_name,
                    coordinates: [
                      parseFloat(result.lat),
                      parseFloat(result.lon),
                    ] as [number, number],
                    source: 'nominatim' as const,
                    originalData: result,
                  }),
                );
                allResults.push(...nominatimResults);
              }
            }
          } catch (e) {
            if (e instanceof Error && e.name !== 'AbortError') {
              console.warn('Nominatim API search failed:', e);
            }
          }
        }

        setResults(allResults);
      } catch (e) {
        if (e instanceof Error && e.name !== 'AbortError') {
          setError('Search failed');
        }
      } finally {
        setLoading(false);
      }
    };

    searchBothAPIs();

    return () => controller.abort();
  }, [debouncedSearch, selectedResult, searchSource]);

  const handleResultClick = (r: SearchResult) => {
    if (!r.coordinates) return;

    const coords: [number, number] = r.coordinates;
    setMarker(coords);
    onChange?.(coords);
    setResults([]);
    setSearch(r.displayName);
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
        label: selectedResult.displayName,
        placeId: selectedResult.id,
        source: selectedResult.source,
        displayName: selectedResult.displayName,
        originalResult: selectedResult.originalData,
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

  // --- Polygon fetching logic (only for Nominatim results) ---
  useEffect(() => {
    const fetchPolygons = async () => {
      const newPolygons: { [placeId: string]: Array<Array<[number, number]>> } =
        {};
      await Promise.all(
        results.map(async (r) => {
          if (r.source === 'nominatim' && r.originalData) {
            const nominatimData = r.originalData as NominatimResult;
            if (
              nominatimData.osm_type === 'relation' ||
              nominatimData.osm_type === 'way'
            ) {
              try {
                const osmTypeLetter = nominatimData.osm_type
                  .charAt(0)
                  .toUpperCase();
                const res = await fetch(
                  `https://nominatim.openstreetmap.org/details.php?osmtype=${osmTypeLetter}&osmid=${nominatimData.place_id}&format=json&polygon_geojson=1`,
                );
                const data = await res.json();
                if (data?.geometry?.coordinates) {
                  newPolygons[r.id] = normalizeCoords(
                    data.geometry.coordinates,
                  );
                }
              } catch (e) {}
            }
          }
        }),
      );
      setPolygons(newPolygons);
    };
    if (results.length > 0) fetchPolygons();
    else setPolygons({});
  }, [results]);

  useEffect(() => {
    if (mapRef.current && marker && isMounted) {
      try {
        mapRef.current.setView(marker, mapRef.current.getZoom());
      } catch (error) {
        console.warn('Error adjusting map view:', error);
      }
    }
  }, [marker, isMounted]);

  useEffect(() => {
    if (!mapRef.current || results.length === 0 || !isMounted) return;

    try {
      const bounds = L.latLngBounds(
        results.filter((r) => r.coordinates).map((r) => r.coordinates!),
      );
      Object.values(polygons).forEach((polys) =>
        polys.forEach((poly) => bounds.extend(poly)),
      );
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [20, 20] });
      }
    } catch (error) {
      console.warn('Error fitting bounds:', error);
    }
  }, [results, polygons, isMounted]);

  return (
    <div
      className={
        expandedStyle
          ? 'rounded-lg border border-border bg-card shadow-sm p-3 w-full max-w-none'
          : 'rounded-lg border border-border bg-card shadow-sm p-3 w-full max-w-md'
      }
    >
      <div className="mb-3 space-y-2">
        <div className="flex gap-2 items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for a place..."
            className="flex-1"
          />
          {loading && (
            <div className="p-2">
              <LoadingSpinner />
            </div>
          )}
        </div>

        <div className="flex gap-2 items-center text-sm">
          <span className="text-muted-foreground">Search in:</span>
          <select
            value={searchSource}
            onChange={(e) => setSearchSource(e.target.value as SearchSource)}
            className="px-2 py-1 text-xs border border-border rounded bg-background"
          >
            <option value="both">Both APIs</option>
            <option value="globalise">GLOBALISE only</option>
            <option value="nominatim">OpenStreetMap only</option>
          </select>
        </div>
      </div>

      {!globaliseAvailable &&
        debouncedSearch &&
        (searchSource === 'both' || searchSource === 'globalise') && (
          <div className="mb-3 text-xs text-muted-foreground bg-yellow-50 border border-yellow-200 rounded p-2">
            <span className="font-medium">Note:</span> GLOBALISE historical
            places are currently unavailable.{' '}
            {searchSource === 'both'
              ? 'Showing OpenStreetMap results only.'
              : 'Please try OpenStreetMap instead.'}
          </div>
        )}

      {results.length > 0 && (
        <div className="mb-2">
          <div className="text-xs text-muted-foreground mb-1">
            Found {results.length} result{results.length !== 1 ? 's' : ''}
            {searchSource === 'both' && (
              <>
                {' '}
                ({results.filter((r) => r.source === 'globalise').length}{' '}
                GLOBALISE,{' '}
                {results.filter((r) => r.source === 'nominatim').length} OSM)
              </>
            )}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <ul className="mb-3 max-h-32 overflow-auto border rounded-lg">
          {results.map((r) => (
            <li
              key={r.id}
              className="p-2 cursor-pointer border-b last:border-0 hover:bg-muted/50 flex items-center gap-2"
              onClick={() => handleResultClick(r)}
            >
              {searchSource === 'both' && (
                <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">
                  {r.source === 'globalise' ? 'GLOBALISE' : 'OSM'}
                </span>
              )}
              {r.displayName}
            </li>
          ))}
        </ul>
      )}

      <div
        className="rounded-lg overflow-hidden border mb-3"
        style={{ height: 180 }}
      >
        {isMounted && (
          <MapContainer
            key={mapKey}
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
            {results
              .filter((r) => r.coordinates)
              .map((r) => {
                const icon = getDefaultIcon();
                return icon ? (
                  <Marker
                    key={r.id}
                    position={r.coordinates!}
                    eventHandlers={{ click: () => handleResultClick(r) }}
                    icon={icon}
                  >
                    <Popup>{r.displayName}</Popup>
                  </Marker>
                ) : null;
              })}
            {Object.entries(polygons).map(([placeId, polys]) =>
              polys.map((poly, i) => (
                <Polygon
                  key={`${placeId}-${i}`}
                  positions={poly}
                  pathOptions={{
                    color: '#3388ff',
                    weight: 2,
                    fillOpacity: 0.1,
                  }}
                />
              )),
            )}
            <LocationMarker
              value={marker}
              onChange={(coords) => setMarker(coords)}
            />
          </MapContainer>
        )}
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
