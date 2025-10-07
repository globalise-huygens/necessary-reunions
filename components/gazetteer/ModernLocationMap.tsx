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
              <div style="text-align: center; padding: 8px; font-family: inherit;">
                <h3 style="font-weight: 600; color: hsl(180, 12%, 72%); font-size: 16px; margin: 0 0 4px 0;">Kerala, India</h3>
                <p style="color: hsl(0, 0%, 45.1%); font-size: 14px; margin: 0 0 4px 0;">General region</p>
                <p style="color: hsl(0, 0%, 45.1%); font-size: 12px; margin: 0;">Exact location for "${placeName}" not found</p>
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
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
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
