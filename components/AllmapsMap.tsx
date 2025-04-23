'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { WarpedMapLayer } from '@allmaps/leaflet';
import { MapPin } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';
import { MapControls } from './MapControls';

export default function AllmapsMap() {
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

  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const warpedRef = useRef<WarpedMapLayer | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const [ready, setReady] = useState(false);

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

    fetch(
      'https://globalise-huygens.github.io/necessary-reunions/manifest.json',
    )
      .then((res) => res.json())
      .then((manifest) => {
        manifest.items.forEach((canvas: any) => {
          if (canvas.navPlace?.features?.[0]?.geometry?.coordinates) {
            const ring = canvas.navPlace.features[0].geometry.coordinates[0];
            const latlngs = ring.map((c: [number, number]) => [c[1], c[0]]);
            polygonRef.current?.setLatLngs(latlngs as any);
          }

          (canvas.annotations || []).forEach((annoPageRef: any) => {
            fetch(annoPageRef.id)
              .then((r) => r.json())
              .then((page: any) => {
                page.items
                  .filter((a: any) => a.motivation === 'georeferencing')
                  .forEach((a: any) => {
                    warped
                      .addGeoreferenceAnnotationByUrl(a.id)
                      .catch(console.error);

                    a.body.features.forEach((f: any) => {
                      const [lon, lat] = f.geometry.coordinates;
                      L.marker([lat, lon], {
                        icon: lucideMarkerIcon(),
                      }).addTo(markersRef.current!);
                    });
                  });
              })
              .catch(console.error);
          });
        });
      })
      .catch(console.error)
      .finally(() => setReady(true));

    return () => {
      map.remove();
      mapRef.current = null;
      warpedRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      {ready &&
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
