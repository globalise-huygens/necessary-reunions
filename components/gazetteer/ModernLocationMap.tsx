'use client';

import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface ModernLocationMapProps {
  placeName: string;
  fallbackName: string;
}

declare global {
  interface Window {
    L: any;
  }
}

export default function ModernLocationMap({
  placeName,
  fallbackName,
}: ModernLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initializeMap = async () => {
      if (typeof window === 'undefined') return;

      try {
        // Import Leaflet dynamically
        const L = (await import('leaflet')).default;

        // Fix icon paths
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: '/leaflet/marker-icon-2x.png',
          iconUrl: '/leaflet/marker-icon.png',
          shadowUrl: '/leaflet/marker-shadow.png',
        });

        if (!mapContainer.current || !isMounted) return;

        // Initialize map
        const map = L.map(mapContainer.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView([10.8505, 76.2711], 8); // Default to Kerala

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 18,
        }).addTo(map);

        mapInstance.current = map;

        // Try to geocode the location
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
              // Add marker and center map
              L.marker([lat, lon])
                .addTo(map)
                .bindPopup(
                  `
                  <div class="text-center">
                    <h3 class="font-semibold text-primary">${placeName}</h3>
                    <p class="text-sm text-muted-foreground">Modern location</p>
                    <p class="text-xs text-muted-foreground">${lat.toFixed(
                      4,
                    )}, ${lon.toFixed(4)}</p>
                  </div>
                `,
                )
                .openPopup();

              map.setView([lat, lon], 12);
              setError(null);
            } else {
              throw new Error('Invalid coordinates received');
            }
          } else {
            // Fallback: try with the original historical name
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
                L.marker([lat, lon])
                  .addTo(map)
                  .bindPopup(
                    `
                    <div class="text-center">
                      <h3 class="font-semibold text-primary">${fallbackName}</h3>
                      <p class="text-sm text-muted-foreground">Historical name match</p>
                      <p class="text-xs text-muted-foreground">${lat.toFixed(
                        4,
                      )}, ${lon.toFixed(4)}</p>
                    </div>
                  `,
                  )
                  .openPopup();

                map.setView([lat, lon], 12);
                setError(null);
              } else {
                throw new Error('No valid location found');
              }
            } else {
              throw new Error('Location not found');
            }
          }
        } catch (geocodeError) {
          console.warn('Geocoding failed:', geocodeError);
          setError('Location not found on modern maps');

          // Add a general Kerala marker as fallback
          L.marker([10.8505, 76.2711])
            .addTo(map)
            .bindPopup(
              `
              <div class="text-center">
                <h3 class="font-semibold text-primary">Kerala, India</h3>
                <p class="text-sm text-muted-foreground">General region</p>
                <p class="text-xs text-muted-foreground">Exact location for "${placeName}" not found</p>
              </div>
            `,
            )
            .openPopup();
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Map initialization failed:', error);
        setError('Failed to load map');
        setIsLoading(false);
      }
    };

    initializeMap();

    return () => {
      isMounted = false;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [placeName, fallbackName]);

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
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded-lg z-10">
          <div className="text-center text-muted-foreground">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
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
