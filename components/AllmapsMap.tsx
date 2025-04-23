'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { WarpedMapLayer } from '@allmaps/leaflet';
import { MapPin } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';
import { MapControls } from './MapControls';

interface AllmapsMapProps {
  manifest: any;
  currentCanvas: number;
}

export default function AllmapsMap({
  manifest,
  currentCanvas,
}: AllmapsMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const warpedRef = useRef<WarpedMapLayer | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!container.current || mapRef.current) return;

    const map = L.map(container.current, { center: [9.9, 76.4], zoom: 8 });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    polygonRef.current = L.polygon([], { weight: 2 }).addTo(map);

    map.createPane('warpedPane');
    const warped = new WarpedMapLayer(null, { pane: 'warpedPane' });
    warpedRef.current = warped.addTo(map);

    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized || !mapRef.current) return;
    const map = mapRef.current!;
    const markers = markersRef.current!;
    const outline = polygonRef.current!;

    markers.clearLayers();
    outline.setLatLngs([]);

    if (warpedRef.current) {
      map.removeLayer(warpedRef.current);
    }

    map.createPane('warpedPane');
    const warped = new WarpedMapLayer(null, { pane: 'warpedPane' });
    warpedRef.current = warped.addTo(map);

    const canvas = manifest.items[currentCanvas];

    if (canvas.navPlace?.features?.[0]?.geometry?.coordinates) {
      const ring = canvas.navPlace.features[0].geometry.coordinates[0];
      const latlngs = ring.map((c: [number, number]) => [c[1], c[0]]);
      outline.setLatLngs(latlngs as any);
    }

    (canvas.annotations || []).forEach((annoRef: any) => {
      fetch(annoRef.id)
        .then((r) => r.json())
        .then((page: any) => {
          page.items
            .filter((a: any) => a.motivation === 'georeferencing')
            .forEach((a: any) => {
              warped.addGeoreferenceAnnotationByUrl(a.id).catch(console.error);
              a.body.features.forEach((f: any) => {
                const [lon, lat] = f.geometry.coordinates;
                L.marker([lat, lon], { icon: lucideMarkerIcon() }).addTo(
                  markers,
                );
              });
            });
        })
        .catch(console.error);
    });
  }, [initialized, manifest, currentCanvas]);

  const lucideMarkerIcon = () => {
    const svg = renderToStaticMarkup(
      <MapPin strokeWidth={2} width={24} height={24} />,
    );
    return L.divIcon({
      html: svg,
      className: 'leaflet-lucide-marker',
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });
  };

  return (
    <div className="relative w-full h-full">
      {initialized &&
        mapRef.current &&
        warpedRef.current &&
        markersRef.current &&
        polygonRef.current && (
          <MapControls
            map={mapRef.current}
            overlay={warpedRef.current}
            markers={markersRef.current}
            polygon={polygonRef.current}
          />
        )}
      <div ref={container} className="w-full h-full" />
    </div>
  );
}
