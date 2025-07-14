'use client';

import 'leaflet/dist/leaflet.css';
import { GeoSearchResult } from '@/lib/types';
import React, { useEffect, useRef } from 'react';

interface GeoTagMapProps {
  selectedLocation?: GeoSearchResult | null;
  searchResults?: GeoSearchResult[];
  onLocationSelect?: (location: GeoSearchResult) => void;
  className?: string;
}

export default function GeoTagMap({
  selectedLocation,
  searchResults = [],
  onLocationSelect,
  className = '',
}: GeoTagMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const initializationRef = useRef(false);

  useEffect(() => {
    if (
      !mapRef.current ||
      initializationRef.current ||
      typeof window === 'undefined'
    )
      return;

    initializationRef.current = true;

    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      // Initialize map
      const map = L.map(mapRef.current!).setView([51.505, -0.09], 2);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      initializationRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === 'undefined') return;

    markersRef.current.forEach((marker) => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current = [];

    import('leaflet').then((L) => {
      if (searchResults.length > 0) {
        searchResults.forEach((result) => {
          const lat = parseFloat(result.lat);
          const lon = parseFloat(result.lon);

          const marker = L.marker([lat, lon]).addTo(mapInstanceRef.current);
          marker.bindPopup(result.display_name);

          if (onLocationSelect) {
            marker.on('click', () => {
              onLocationSelect(result);
            });
          }

          markersRef.current.push(marker);
        });

        if (searchResults.length === 1) {
          const lat = parseFloat(searchResults[0].lat);
          const lon = parseFloat(searchResults[0].lon);
          mapInstanceRef.current.setView([lat, lon], 10);
        } else if (searchResults.length > 1) {
          const group = new L.FeatureGroup(markersRef.current);
          mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
        }
      }

      if (selectedLocation) {
        const lat = parseFloat(selectedLocation.lat);
        const lon = parseFloat(selectedLocation.lon);

        const selectedIcon = L.icon({
          iconUrl:
            'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          iconRetinaUrl:
            'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          shadowUrl:
            'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
          className: 'selected-location-marker',
        });

        const selectedMarker = L.marker([lat, lon], {
          icon: selectedIcon,
        }).addTo(mapInstanceRef.current);
        selectedMarker.bindPopup(
          `<strong>Selected:</strong><br/>${selectedLocation.display_name}`,
        );
        markersRef.current.push(selectedMarker);

        if (searchResults.length === 0) {
          mapInstanceRef.current.setView([lat, lon], 10);
        }
      }
    });
  }, [selectedLocation, searchResults, onLocationSelect]);

  return (
    <div
      ref={mapRef}
      className={`h-48 w-full rounded-lg border ${className}`}
      style={{ zIndex: 1 }}
    />
  );
}
