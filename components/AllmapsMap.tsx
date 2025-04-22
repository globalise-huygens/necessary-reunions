'use client';

import { useEffect, useRef, useState, ChangeEvent } from 'react';
import L from 'leaflet';
import { WarpedMapLayer } from '@allmaps/leaflet';
import 'leaflet/dist/leaflet.css';

export default function AllmapsMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | undefined>(null);
  const warpedRef = useRef<WarpedMapLayer | null>(null);
  const [opacity, setOpacity] = useState(0.7);

  useEffect(() => {
    if (!container.current || mapRef.current) return;

    const map = L.map(container.current, {
      center: [9.9, 76.4],
      zoom: 8,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    map.createPane('warpedPane');
    const pane = map.getPane('warpedPane')!;
    pane.style.zIndex = '450';
    pane.style.opacity = opacity.toString();

    const warped = new WarpedMapLayer(null);
    (warped as any).options = { pane: 'warpedPane' };
    warped.addTo(map);
    warpedRef.current = warped;

    warped.on('load', () => console.log('Warp loaded'));
    warped.on('error', (err) => console.error('Warp error:', err));

    fetch(
      'https://github.com/globalise-huygens/necessary-reunions/blob/main/data/manifest.json',
    )
      .then((r) => r.json())
      .then((manifest) => {
        const ghAnnoUrls: string[] = (manifest.items || [])
          .flatMap((canvas: any) => canvas.annotations || [])
          .map((anno: any) => anno.id);

        ghAnnoUrls.forEach((ghUrl) => {
          fetch(ghUrl)
            .then((r) => r.json())
            .then((page: any) => {
              page.items
                .filter((a: any) => a.motivation === 'georeferencing')
                .forEach((a: any) => {
                  warped
                    .addGeoreferenceAnnotationByUrl(a.id)
                    .catch((err) => console.error('Warp failed:', err));
                });
            })
            .catch((err) =>
              console.error('Failed to load annotation JSON:', ghUrl, err),
            );
        });
      })
      .catch((err) => console.error('Manifest fetch error:', err));

    return () => {
      map.remove();
      mapRef.current = undefined;
      warpedRef.current = null;
    };
  }, []);

  function onOpacityChange(e: ChangeEvent<HTMLInputElement>) {
    const value = parseFloat(e.target.value);
    setOpacity(value);
    if (mapRef.current) {
      const pane = mapRef.current.getPane('warpedPane');
      if (pane) pane.style.opacity = value.toString();
    }
  }

  return (
    <div className="relative w-full h-[600px]">
      <div className="absolute top-4 right-4 bg-white p-2 rounded shadow z-[1000]">
        <label className="block text-sm mb-1">
          Overlay opacity: {Math.round(opacity * 100)}%
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={opacity}
          onChange={onOpacityChange}
        />
      </div>

      <div ref={container} className="w-full h-full" />
    </div>
  );
}
