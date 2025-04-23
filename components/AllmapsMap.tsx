'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { WarpedMapLayer } from '@allmaps/leaflet';
import 'leaflet/dist/leaflet.css';
import { MapControls } from './MapControls';

export default function AllmapsMap() {
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
      .then((r) => r.json())
      .then((manifest) => {
        const urls = (manifest.items || [])
          .flatMap((c: any) => c.annotations || [])
          .map((a: any) => a.id);

        interface Manifest {
          items: Canvas[];
        }

        interface Canvas {
          annotations?: Annotation[];
        }

        interface Annotation {
          id: string;
        }

        interface Page {
          items: GeoreferenceAnnotation[];
        }

        interface GeoreferenceAnnotation {
          id: string;
          motivation: string;
        }

        urls.forEach((url: string) =>
          fetch(url)
            .then((r) => r.json())
            .then((page: Page) => {
              page.items
                .filter(
                  (a: GeoreferenceAnnotation) =>
                    a.motivation === 'georeferencing',
                )
                .forEach((a: GeoreferenceAnnotation) =>
                  warped
                    .addGeoreferenceAnnotationByUrl(a.id)
                    .catch(console.error),
                );
            })
            .catch(console.error),
        );
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
