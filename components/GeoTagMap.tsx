'use client';

import { GeoSearchResult } from '@/lib/types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useEffect, useRef } from 'react';

// Fix for default markers in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface GeoTagMapProps {
  selectedLocation?: GeoSearchResult | null;
  className?: string;
}

export default function GeoTagMap({ selectedLocation, className = '' }: GeoTagMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current).setView([51.505, -0.09], 2);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing marker
    if (markerRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }

    // Add new marker if location is selected
    if (selectedLocation) {
      const lat = parseFloat(selectedLocation.lat);
      const lon = parseFloat(selectedLocation.lon);
      
      const marker = L.marker([lat, lon]).addTo(mapInstanceRef.current);
      marker.bindPopup(selectedLocation.display_name);
      markerRef.current = marker;

      // Center map on the location
      mapInstanceRef.current.setView([lat, lon], 10);
    }
  }, [selectedLocation]);

  return (
    <div 
      ref={mapRef} 
      className={`h-48 w-full rounded-lg border ${className}`}
      style={{ zIndex: 1 }}
    />
  );
}
