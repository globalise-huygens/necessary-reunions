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
  const [opacity, setOpacity] = useState(0.7);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = L.map(container.current, { center: [9.9, 76.4], zoom: 8 });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    polygonRef.current = L.polygon([], { weight: 2 });

    map.createPane('warpedPane');
    const warped = new WarpedMapLayer(null, { pane: 'warpedPane' });
    warpedRef.current = warped.addTo(map);

    const pane = map.getPane('warpedPane');
    if (pane) pane.style.opacity = opacity.toString();

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

    const warped = new WarpedMapLayer(null, { pane: 'warpedPane' });
    warpedRef.current = warped.addTo(map);

    const pane = map.getPane('warpedPane');
    if (pane) pane.style.opacity = opacity.toString();

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
              const georeferenceAnnotationUrl = a.id;
              a.body.features.forEach((f: any) => {
                const [lon, lat] = f.geometry.coordinates;
                const marker = L.marker([lat, lon], {
                  icon: lucideMarkerIcon(),
                });
                marker.addTo(markers);
              });
            });
        })
        .catch(() => {});
    });
  }, [initialized, manifest, currentCanvas]);

  useEffect(() => {
    if (!mapRef.current) return;
    const pane = mapRef.current.getPane('warpedPane');
    if (pane) pane.style.opacity = opacity.toString();
  }, [opacity]);

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
    <div className="relative w-full h-full pb-14 sm:pb-0">
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
            opacity={opacity}
            onOpacityChange={setOpacity}
          />
        )}
      <div
        ref={container}
        className="w-full h-full z-10 absolute top-0 left-0"
      />
    </div>
  );
}
