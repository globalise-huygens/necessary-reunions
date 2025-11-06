/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

'use client';

import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ModernLocationMapProps {
  placeName: string;
  fallbackName: string;
  coordinates?: {
    x: number;
    y: number;
  };
  isGeotagged?: boolean;
}

interface CachedGeocodingResult {
  lat: number;
  lon: number;
  displayName: string;
  timestamp: number;
  isFallback?: boolean;
}

declare global {
  interface Window {
    L: any;
  }
}

const GEOCODING_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;
const CACHE_KEY_PREFIX = 'geocoding_cache_';

function getCachedGeocodingResult(
  placeName: string,
): CachedGeocodingResult | null {
  if (typeof window === 'undefined') return null;

  try {
    const cacheKey = CACHE_KEY_PREFIX + placeName.toLowerCase();
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as CachedGeocodingResult;
    const now = Date.now();

    if (now - parsed.timestamp < GEOCODING_CACHE_DURATION) {
      return parsed;
    }

    localStorage.removeItem(cacheKey);
    return null;
  } catch {
    return null;
  }
}

function setCachedGeocodingResult(
  placeName: string,
  result: Omit<CachedGeocodingResult, 'timestamp'>,
): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheKey = CACHE_KEY_PREFIX + placeName.toLowerCase();
    const cacheData: CachedGeocodingResult = {
      ...result,
      timestamp: Date.now(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (e) {
    console.warn('Failed to cache geocoding result:', e);
  }
}

export default function ModernLocationMap({
  placeName,
  fallbackName,
  coordinates,
  isGeotagged,
}: ModernLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const isInitializing = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const containerRef = mapContainer.current;

    if (isInitializing.current) {
      return;
    }

    const initializeMap = async () => {
      isInitializing.current = true;
      if (typeof window === 'undefined') {
        isInitializing.current = false;
        return;
      }

      try {
        const leaflet = (await import('leaflet')).default;

        delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
        leaflet.Icon.Default.mergeOptions({
          iconRetinaUrl: '/leaflet/marker-icon-2x.png',
          iconUrl: '/leaflet/marker-icon.png',
          shadowUrl: '/leaflet/marker-shadow.png',
        });

        if (
          !mapContainer.current ||
          !isMounted ||
          !mapContainer.current.isConnected
        ) {
          return;
        }

        if ((mapContainer.current as any)._leaflet_id) {
          setIsLoading(false);
          isInitializing.current = false;
          return;
        }

        const map = leaflet
          .map(mapContainer.current, {
            zoomControl: true,
            attributionControl: true,
            closePopupOnClick: false,
            trackResize: true,
          })
          .setView([10.8505, 76.2711], 8);

        leaflet
          .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18,
          })
          .addTo(map);

        mapInstance.current = map;

        if (isGeotagged && coordinates && coordinates.y && coordinates.x) {
          const lat = coordinates.y;
          const lon = coordinates.x;

          if (!isNaN(lat) && !isNaN(lon)) {
            leaflet
              .marker([lat, lon])
              .addTo(map)
              .bindPopup(
                `
                <div style="text-align: center; padding: 8px; font-family: inherit;">
                  <h3 style="font-weight: 600; color: hsl(165, 22%, 26%); font-size: 16px; margin: 0 0 4px 0;">${placeName}</h3>
                  <p style="color: hsl(0, 0%, 45.1%); font-size: 14px; margin: 0 0 4px 0;">Geotagged location</p>
                  <p style="color: hsl(0, 0%, 45.1%); font-size: 12px; margin: 0;">${lat.toFixed(
                    4,
                  )}, ${lon.toFixed(4)}</p>
                </div>
              `,
              )
              .openPopup();

            map.setView([lat, lon], 13);
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- isMounted can change during async operations
            if (!isMounted) return;
            setError(null);
            setIsLoading(false);
            isInitializing.current = false;
            return;
          }
        }

        const cachedResult = getCachedGeocodingResult(placeName);
        if (cachedResult) {
          if (
            cachedResult.lat &&
            cachedResult.lon &&
            !isNaN(cachedResult.lat) &&
            !isNaN(cachedResult.lon)
          ) {
            leaflet
              .marker([cachedResult.lat, cachedResult.lon])
              .addTo(map)
              .bindPopup(
                `
              <div style="text-align: center; padding: 8px; font-family: inherit;">
                <h3 style="font-weight: 600; color: ${cachedResult.isFallback ? 'hsl(22, 32%, 26%)' : 'hsl(165, 22%, 26%)'}; font-size: 16px; margin: 0 0 4px 0;">${cachedResult.displayName}</h3>
                <p style="color: hsl(0, 0%, 45.1%); font-size: 14px; margin: 0 0 4px 0;">${cachedResult.isFallback ? 'Historical name match' : 'Modern location'} (cached)</p>
                <p style="color: hsl(0, 0%, 45.1%); font-size: 12px; margin: 0;">${cachedResult.lat.toFixed(
                  4,
                )}, ${cachedResult.lon.toFixed(4)}</p>
              </div>
            `,
              )
              .openPopup();

            map.setView([cachedResult.lat, cachedResult.lon], 12);
          }

          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- isMounted can change during async operations
          if (!isMounted) return;
          setError(null);
          setIsLoading(false);
          isInitializing.current = false;
          return;
        }

        try {
          const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            `${placeName}, Kerala, India`,
          )}&limit=1`;

          const response = await fetch(geocodeUrl);
          const data = await response.json();

          if (data && data.length > 0) {
            const result = data[0];
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);

            if (!isNaN(lat) && !isNaN(lon)) {
              setCachedGeocodingResult(placeName, {
                lat,
                lon,
                displayName: result.display_name,
                isFallback: false,
              });

              leaflet
                .marker([lat, lon])
                .addTo(map)
                .bindPopup(
                  `
                  <div style="text-align: center; padding: 8px; font-family: inherit;">
                    <h3 style="font-weight: 600; color: hsl(165, 22%, 26%); font-size: 16px; margin: 0 0 4px 0;">${placeName}</h3>
                    <p style="color: hsl(0, 0%, 45.1%); font-size: 14px; margin: 0 0 4px 0;">Modern location</p>
                    <p style="color: hsl(0, 0%, 45.1%); font-size: 12px; margin: 0;">${lat.toFixed(
                      4,
                    )}, ${lon.toFixed(4)}</p>
                  </div>
                `,
                )
                .openPopup();

              map.setView([lat, lon], 12);
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- isMounted can change during async fetch
              if (!isMounted) return;
              setError(null);
              setIsLoading(false);
            } else {
              throw new Error('Invalid coordinates received');
            }
          } else {
            const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              `${fallbackName}, Kerala, India`,
            )}&limit=1`;

            const fallbackResponse = await fetch(fallbackUrl);
            const fallbackData = await fallbackResponse.json();

            if (fallbackData && fallbackData.length > 0) {
              const result = fallbackData[0];
              const lat = parseFloat(result.lat);
              const lon = parseFloat(result.lon);

              if (!isNaN(lat) && !isNaN(lon)) {
                setCachedGeocodingResult(placeName, {
                  lat,
                  lon,
                  displayName: result.display_name,
                  isFallback: true,
                });

                leaflet
                  .marker([lat, lon])
                  .addTo(map)
                  .bindPopup(
                    `
                    <div style="text-align: center; padding: 8px; font-family: inherit;">
                      <h3 style="font-weight: 600; color: hsl(22, 32%, 26%); font-size: 16px; margin: 0 0 4px 0;">${fallbackName}</h3>
                      <p style="color: hsl(0, 0%, 45.1%); font-size: 14px; margin: 0 0 4px 0;">Historical name match</p>
                      <p style="color: hsl(0, 0%, 45.1%); font-size: 12px; margin: 0;">${lat.toFixed(
                        4,
                      )}, ${lon.toFixed(4)}</p>
                    </div>
                  `,
                  )
                  .openPopup();

                map.setView([lat, lon], 12);
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- isMounted can change during async fetch
                if (!isMounted) return;
                setError(null);
                setIsLoading(false);
              } else {
                throw new Error('No valid location found');
              }
            } else {
              throw new Error('Location not found');
            }
          }
        } catch {
          setError('Location not found on modern maps');

          leaflet
            .marker([10.8505, 76.2711])
            .addTo(map)
            .bindPopup(
              `
              <div style="text-align: center; padding: 8px; font-family: inherit;">
                <h3 style="font-weight: 600; color: hsl(180, 12%, 72%); font-size: 16px; margin: 0 0 4px 0;">Kerala, India</h3>
                <p style="color: hsl(0, 0%, 45.1%); font-size: 14px; margin: 0 0 4px 0;">General region</p>
                <p style="color: hsl(0, 0%, 45.1%); font-size: 12px; margin: 0;">Exact location for "${placeName}" not found</p>
              </div>
            `,
            )
            .openPopup();
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- isMounted can change during async operations
        if (!isMounted) return;
        setIsLoading(false);
        isInitializing.current = false;
      } catch {
        if (!isMounted) return;
        setError('Failed to load map');
        setIsLoading(false);
        isInitializing.current = false;
      }
    };

    initializeMap().catch(() => {
      isInitializing.current = false;
    });

    return () => {
      isMounted = false;
      isInitializing.current = false;

      const currentMap = mapInstance.current;
      mapInstance.current = null;

      if (currentMap) {
        try {
          if (currentMap.dragging) {
            currentMap.dragging.disable();
          }
          if (currentMap.touchZoom) {
            currentMap.touchZoom.disable();
          }
          if (currentMap.doubleClickZoom) {
            currentMap.doubleClickZoom.disable();
          }
          if (currentMap.scrollWheelZoom) {
            currentMap.scrollWheelZoom.disable();
          }
          if (currentMap.boxZoom) {
            currentMap.boxZoom.disable();
          }
          if (currentMap.keyboard) {
            currentMap.keyboard.disable();
          }

          currentMap.off();
          currentMap.stop();
          currentMap.remove();
        } catch (e) {
          console.warn('Error cleaning up map:', e);
        }
      }

      if (containerRef) {
        try {
          delete (containerRef as any)._leaflet_id;
        } catch (e) {
          console.warn('Error cleaning up container:', e);
        }
      }
    };
  }, [placeName, fallbackName, coordinates, isGeotagged]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20 rounded-lg">
        <div className="text-center text-muted-foreground">
          <MapPin className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <style jsx>{`
        .leaflet-marker-icon {
          filter: hue-rotate(200deg) saturate(1.3) brightness(0.9)
            drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2)) !important;
        }
        .leaflet-marker-shadow {
          filter: opacity(0.4) !important;
        }
        .leaflet-popup-content-wrapper {
          background: hsl(0 0% 100%);
          border-radius: 0.5rem;
          box-shadow:
            0 10px 15px -3px rgba(0, 0, 0, 0.1),
            0 4px 6px -2px rgba(0, 0, 0, 0.05);
          border: 1px solid hsl(0 0% 89.8%);
          font-family: inherit;
        }
        .leaflet-popup-tip {
          background: hsl(0 0% 100%);
          border: 1px solid hsl(0 0% 89.8%);
        }
        .leaflet-popup-content {
          color: hsl(165, 22%, 26%);
          font-family: inherit;
          margin: 8px 12px;
        }
        .leaflet-container {
          font-family: inherit;
        }
      `}</style>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded-lg z-10">
          <div className="text-center text-muted-foreground">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-sm">Finding location...</p>
          </div>
        </div>
      )}
      <div
        ref={mapContainer}
        className="w-full h-full rounded-lg"
        style={{ minHeight: '256px' }}
      />
    </div>
  );
}
