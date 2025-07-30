'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from './Button';
import { Input } from './Input';
import { LoadingSpinner } from './LoadingSpinner';

const searchCache = new Map<string, SearchResult[]>();
const polygonCache = new Map<string, Array<Array<[number, number]>>>();
const maxCacheSize = 100;

const cleanupCache = (cache: Map<string, any>) => {
  if (cache.size > maxCacheSize) {
    const keysToDelete = Array.from(cache.keys()).slice(
      0,
      cache.size - maxCacheSize,
    );
    keysToDelete.forEach((key) => cache.delete(key));
  }
};

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
  onGeotagCleared?: () => void;
  initialGeotag?: {
    marker: [number, number];
    label: string;
    originalResult: NominatimResult | GlobaliseResult;
  };
  showClearButton?: boolean;
}
interface NominatimResult {
  display_name: string;
  osm_type: string;
  osm_id: number;
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
  onGeotagCleared,
  expandedStyle = false,
  initialGeotag,
  showClearButton = false,
}) => {
  const [marker, setMarker] = useState<[number, number] | undefined>(
    value || initialGeotag?.marker,
  );
  const [search, setSearch] = useState(initialGeotag?.label || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(
    createSearchResultFromInitial(initialGeotag),
  );
  const [polygons, setPolygons] = useState<{
    [placeId: string]: Array<Array<[number, number]>>;
  }>({});

  const [globaliseAvailable, setGlobaliseAvailable] = useState(true);
  const [searchSource, setSearchSource] = useState<SearchSource>('both');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const polygonsLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    setIsMounted(true);

    const map = L.map(mapContainerRef.current, {
      center: marker || defaultCenter,
      zoom: zoom,
      preferCanvas: true,
      maxZoom: 18,
      zoomControl: true,
      attributionControl: true,
    });

    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
      detectRetina: true,
      updateWhenIdle: true,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    polygonsLayerRef.current = L.layerGroup().addTo(map);

    let clickTimeout: NodeJS.Timeout;
    map.on('click', (e: L.LeafletMouseEvent) => {
      clearTimeout(clickTimeout);
      clickTimeout = setTimeout(() => {
        setMarker([e.latlng.lat, e.latlng.lng]);
        onChange?.([e.latlng.lat, e.latlng.lng]);
      }, 100);
    });

    setInitialized(true);

    return () => {
      setIsMounted(false);
      setInitialized(false);
      clearTimeout(clickTimeout);

      if (markersRef.current) {
        markersRef.current.clearLayers();
      }
      if (polygonsLayerRef.current) {
        polygonsLayerRef.current.clearLayers();
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (initialized && mapRef.current && marker) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
      }

      const icon = getDefaultIcon();
      if (icon) {
        userMarkerRef.current = L.marker(marker, { icon }).addTo(
          mapRef.current,
        );
      }

      mapRef.current.setView(marker, mapRef.current.getZoom());
    }
  }, [marker, initialized]);

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      clearTimeout(timerId);
    };
  }, [search]);

  const searchAPIs = useCallback(
    async (query: string, source: SearchSource) => {
      const cacheKey = `${query}:${source}`;
      if (searchCache.has(cacheKey)) {
        return searchCache.get(cacheKey)!;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      try {
        const allResults: SearchResult[] = [];

        const promises: Promise<void>[] = [];

        if (source === 'both' || source === 'globalise') {
          promises.push(
            fetch(`/api/globalise/places?name=${encodeURIComponent(query)}`, {
              signal,
              credentials: 'include',
            })
              .then(async (response) => {
                if (response.ok) {
                  const data = await response.json();
                  if (data.features && Array.isArray(data.features)) {
                    const globaliseResults: SearchResult[] = data.features.map(
                      (feature: GlobaliseResult) => ({
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
                      }),
                    );
                    allResults.push(...globaliseResults);
                    if (globaliseResults.length > 0) {
                      setGlobaliseAvailable(true);
                    }
                  }
                } else if (response.status === 403) {
                  setGlobaliseAvailable(false);
                }
              })
              .catch((e) => {
                if (e.name !== 'AbortError') {
                  console.warn('GLOBALISE API search failed:', e);
                }
              }),
          );
        }

        if (source === 'both' || source === 'nominatim') {
          promises.push(
            fetch(
              `https://nominatim.openstreetmap.org/search?format=json&limit=10&q=${encodeURIComponent(
                query,
              )}`,
              {
                signal,
                headers: { 'Accept-Language': 'en' },
              },
            )
              .then(async (response) => {
                if (response.ok) {
                  const data = await response.json();
                  if (Array.isArray(data)) {
                    const nominatimResults: SearchResult[] = data.map(
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
              })
              .catch((e) => {
                if (e.name !== 'AbortError') {
                  console.warn('Nominatim API search failed:', e);
                }
              }),
          );
        }

        await Promise.all(promises);

        searchCache.set(cacheKey, allResults);
        cleanupCache(searchCache);

        return allResults;
      } catch (e) {
        if (e instanceof Error && e.name !== 'AbortError') {
          throw new Error('Search failed');
        }
        return [];
      }
    },
    [],
  );

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

    searchAPIs(debouncedSearch, searchSource)
      .then((results) => {
        setResults(results);
      })
      .catch((error) => {
        setError('Search failed');
        console.error('Search error:', error);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedSearch, selectedResult, searchSource, searchAPIs]);

  const handleResultClick = useCallback(
    (r: SearchResult) => {
      if (!r.coordinates) return;

      const coords: [number, number] = r.coordinates;
      setMarker(coords);
      onChange?.(coords);
      setResults([]);
      setSearch(r.displayName);
      setSelectedResult(r);

      onGeotagSelected?.({
        marker: coords,
        label: r.displayName,
        placeId: r.id,
        source: r.source,
        displayName: r.displayName,
        originalResult: r.originalData,
      });
    },
    [onChange, onGeotagSelected],
  );

  const handleClear = useCallback(() => {
    setMarker(undefined);
    setSearch('');
    setSelectedResult(null);
    setResults([]);
    setError(null);
    onGeotagCleared?.();
  }, [onGeotagCleared]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const fetchPolygonsForResults = useCallback(
    async (results: SearchResult[]) => {
      const newPolygons: { [placeId: string]: Array<Array<[number, number]>> } =
        {};

      const nominatimResults = results
        .filter((r) => r.source === 'nominatim' && r.originalData)
        .slice(0, 5);

      const promises = nominatimResults.map(async (r) => {
        const cacheKey = `polygon:${r.id}`;

        if (polygonCache.has(cacheKey)) {
          newPolygons[r.id] = polygonCache.get(cacheKey)!;
          return;
        }

        const nominatimData = r.originalData as NominatimResult;
        if (
          nominatimData.osm_type === 'relation' ||
          nominatimData.osm_type === 'way'
        ) {
          try {
            const osmTypeLetter = nominatimData.osm_type
              .charAt(0)
              .toUpperCase();
            const response = await fetch(
              `https://nominatim.openstreetmap.org/details.php?osmtype=${osmTypeLetter}&osmid=${nominatimData.osm_id}&format=json&polygon_geojson=1`,
              { signal: abortControllerRef.current?.signal },
            );

            if (response.ok) {
              const data = await response.json();
              if (data?.geometry?.coordinates) {
                const normalized = normalizeCoords(data.geometry.coordinates);
                newPolygons[r.id] = normalized;
                polygonCache.set(cacheKey, normalized);
                cleanupCache(polygonCache);
              }
            }
          } catch (e) {}
        }
      });

      await Promise.all(promises);
      return newPolygons;
    },
    [],
  );

  const polygonData = useMemo(() => {
    if (results.length === 0) return {};

    fetchPolygonsForResults(results).then(setPolygons);
    return polygons;
  }, [results, fetchPolygonsForResults]);

  function normalizeCoords(coords: any): Array<Array<[number, number]>> {
    if (!Array.isArray(coords) || !coords[0] || !coords[0][0]) return [];
    // Nominatim returns [lon, lat], Leaflet needs [lat, lon], so we swap them.
    if (typeof coords[0][0] === 'number') {
      return [coords.map((pt: any) => [pt[1], pt[0]])];
    } else {
      return coords.map((poly: any) => poly.map((pt: any) => [pt[1], pt[0]]));
    }
  }

  const updateMarkers = useCallback(() => {
    if (!initialized || !mapRef.current || !markersRef.current) return;

    markersRef.current.clearLayers();

    const icon = getDefaultIcon();
    if (!icon) return;

    const validResults = results.filter((r) => r.coordinates);

    const markers = validResults.map((r) => {
      const resultMarker = L.marker(r.coordinates!, { icon })
        .bindPopup(r.displayName, { closeButton: false, maxWidth: 300 })
        .on('click', () => handleResultClick(r));
      return resultMarker;
    });

    markers.forEach((marker) => markersRef.current!.addLayer(marker));

    if (validResults.length > 0) {
      const coordinates = validResults.map((r) => r.coordinates!);

      const polygonCoords: [number, number][] = [];
      Object.values(polygons).forEach((polys) =>
        polys.forEach((poly) => polygonCoords.push(...poly)),
      );

      const allCoords = [...coordinates, ...polygonCoords];

      if (allCoords.length > 0) {
        const bounds = L.latLngBounds(allCoords);
        if (bounds.isValid()) {
          // Use padding and maxZoom to prevent over-zooming
          mapRef.current.fitBounds(bounds, {
            padding: [20, 20],
            maxZoom: 15,
          });
        }
      }
    }
  }, [results, initialized, polygons, handleResultClick]);

  useEffect(() => {
    const timeoutId = setTimeout(updateMarkers, 100);
    return () => clearTimeout(timeoutId);
  }, [updateMarkers]);

  const updatePolygons = useCallback(() => {
    if (!initialized || !mapRef.current || !polygonsLayerRef.current) return;

    polygonsLayerRef.current.clearLayers();

    Object.entries(polygons).forEach(([placeId, polys]) => {
      polys.forEach((poly) => {
        if (polygonsLayerRef.current && poly.length > 2) {
          // Only render valid polygons
          const polygon = L.polygon(poly, {
            color: '#3388ff',
            weight: 2,
            fillOpacity: 0.1,
            interactive: false,
          });
          polygonsLayerRef.current.addLayer(polygon);
        }
      });
    });
  }, [polygons, initialized]);

  useEffect(() => {
    const timeoutId = setTimeout(updatePolygons, 150);
    return () => clearTimeout(timeoutId);
  }, [updatePolygons]);

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
          {results
            .slice(0, 10)
            .map((r /* Limit to 10 results for better performance */) => (
              <li
                key={r.id}
                className="p-2 cursor-pointer border-b last:border-0 hover:bg-muted/50 flex items-center gap-2"
                onClick={() => handleResultClick(r)}
              >
                {searchSource === 'both' && (
                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded flex-shrink-0">
                    {r.source === 'globalise' ? 'GLOBALISE' : 'OSM'}
                  </span>
                )}
                <span className="truncate">{r.displayName}</span>
              </li>
            ))}
          {results.length > 10 && (
            <li className="p-2 text-xs text-muted-foreground text-center border-t bg-muted/30">
              +{results.length - 10} more results (refine search to see more)
            </li>
          )}
        </ul>
      )}

      <div
        ref={mapContainerRef}
        className="rounded-lg overflow-hidden border"
        style={{ height: 180, width: '100%' }}
      />

      {showClearButton && selectedResult && (
        <div className="flex justify-end pt-2 border-t mt-3">
          <Button variant="outline" size="sm" onClick={handleClear}>
            Clear Selection
          </Button>
        </div>
      )}

      {selectedResult && (
        <div className="mt-2 text-xs text-muted-foreground">
          Selected:{' '}
          <span className="font-medium">{selectedResult.displayName}</span>
        </div>
      )}
    </div>
  );
};
