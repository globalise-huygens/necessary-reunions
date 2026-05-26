'use client';

import 'leaflet/dist/leaflet.css';

import { WarpedMapLayer } from '@allmaps/leaflet';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';

interface AllmapsInsetMapProps {
  annotationUrl: string;
  marker: [number, number];
}

const INSET_FOCUS_ZOOM = 12;

export function AllmapsInsetMap({
  annotationUrl,
  marker,
}: AllmapsInsetMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const warpedRef = useRef<WarpedMapLayer | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const [lon, lat] = marker;
    const map = L.map(containerRef.current, {
      center: [lat, lon],
      zoom: 10,
      zoomControl: false,
      attributionControl: false,
    });

    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    map.createPane('warpedPane');
    const warpedPane = map.getPane('warpedPane');
    if (warpedPane) {
      warpedPane.style.zIndex = '410';
    }

    const warped = new WarpedMapLayer(null, { pane: 'warpedPane' });
    warpedRef.current = warped.addTo(map);

    markerRef.current = L.circleMarker([lat, lon], {
      radius: 5,
      color: 'hsl(197, 37%, 24%)',
      weight: 2,
      fillColor: 'hsl(12, 70%, 50%)',
      fillOpacity: 0.95,
    }).addTo(map);

    setTimeout(() => {
      map.invalidateSize();
    }, 0);

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;

      if (warpedRef.current) {
        try {
          warpedRef.current.clear();
          warpedRef.current.remove();
        } catch {
          // Ignore teardown errors from the third-party map layer.
        }
      }

      warpedRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [marker]);

  useEffect(() => {
    const map = mapRef.current;
    const warped = warpedRef.current;

    if (!map || !warped) {
      return;
    }

    const [lon, lat] = marker;

    try {
      warped.clear();
    } catch {
      // Ignore stale layer cleanup errors before reloading the overlay.
    }

    warped
      .addGeoreferenceAnnotationByUrl(annotationUrl)
      .then(() => {
        try {
          map.setView([lat, lon], INSET_FOCUS_ZOOM);
          setStatus('ready');
        } catch {
          map.setView([lat, lon], INSET_FOCUS_ZOOM);
          setStatus('ready');
        }
      })
      .catch(() => {
        map.setView([lat, lon], INSET_FOCUS_ZOOM);
        setStatus('error');
      });
  }, [annotationUrl, marker]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <div ref={containerRef} className="h-full w-full" />
      {status !== 'ready' ? (
        <div className="pointer-events-none absolute inset-x-2 top-2 rounded bg-white/88 px-2 py-1 text-[10px] text-foreground/75 shadow-sm">
          {status === 'loading'
            ? 'Loading Allmaps overlay...'
            : 'Allmaps overlay unavailable. OSM context only.'}
        </div>
      ) : null}
    </div>
  );
}
