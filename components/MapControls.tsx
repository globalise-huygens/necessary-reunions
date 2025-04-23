'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import L from 'leaflet';
import { cn } from '@/lib/utils';

interface MapControlsProps {
  map: L.Map;
  overlay: L.Layer;
  markers: L.LayerGroup;
  polygon: L.Layer;
}

export function MapControls({
  map,
  overlay,
  markers,
  polygon,
}: MapControlsProps) {
  const [opacity, setOpacity] = useState(0.7);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showPolygon, setShowPolygon] = useState(false);
  const [baseLayer, setBaseLayer] = useState<
    'osm' | 'esri' | 'topo' | 'cartoVoyagerLabelsUnder'
  >('cartoVoyagerLabelsUnder');

  const baseLayers = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }),
    esri: L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Tiles &copy; Esri &mdash; Source: Esri, Earthstar Geographics',
      },
    ),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenTopoMap contributors',
    }),
    cartoVoyagerLabelsUnder: L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    ),
  };

  useEffect(() => {
    const layer = baseLayers[baseLayer];
    layer.addTo(map);
    return () => {
      map.eachLayer((l) => {
        if (l !== overlay && l !== markers && l !== polygon) {
          map.removeLayer(l);
        }
      });
    };
  }, [baseLayer, map, overlay, markers, polygon]);

  function onOpacityChange(e: ChangeEvent<HTMLInputElement>) {
    const v = parseFloat(e.target.value);
    setOpacity(v);
    if ('setOpacity' in overlay) {
      (overlay as any).setOpacity(v);
    }
  }

  function toggleMarkers(visible: boolean) {
    setShowMarkers(visible);
    visible ? markers.addTo(map) : map.removeLayer(markers);
  }

  function togglePolygon(visible: boolean) {
    setShowPolygon(visible);
    visible ? polygon.addTo(map) : map.removeLayer(polygon);
  }

  return (
    <div
      className={cn(
        'absolute top-4 right-4 z-[10000] w-64 bg-white border border-border rounded-lg shadow-lg p-4 space-y-4 text-sm text-foreground',
      )}
    >
      <div>
        <label htmlFor="base-layer" className="block font-medium">
          Base layer
        </label>
        <select
          id="base-layer"
          value={baseLayer}
          onChange={(e) => setBaseLayer(e.target.value as any)}
          className="w-full border border-input bg-background rounded-md px-3 py-2"
        >
          <option value="osm">OpenStreetMap</option>
          <option value="esri">ESRI World Imagery</option>
          <option value="topo">OpenTopoMap</option>
          <option value="cartoVoyagerLabelsUnder">
            CartoDB Voyager Labels Under
          </option>
        </select>
      </div>
      <div>
        <label htmlFor="opacity" className="block font-medium">
          Image opacity: {Math.round(opacity * 100)}%
        </label>
        <input
          id="opacity"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={opacity}
          onChange={onOpacityChange}
          className="w-full accent-black"
        />
      </div>
      <div className="flex items-center space-x-2">
        <input
          id="gcp-toggle"
          type="checkbox"
          checked={showMarkers}
          onChange={(e) => toggleMarkers(e.target.checked)}
          className="accent-black"
        />
        <label htmlFor="gcp-toggle" className="text-sm">
          Show markers
        </label>
      </div>
      <div className="flex items-center space-x-2">
        <input
          id="outline-toggle"
          type="checkbox"
          checked={showPolygon}
          onChange={(e) => togglePolygon(e.target.checked)}
          className="accent-black"
        />
        <label htmlFor="outline-toggle" className="text-sm">
          Show outline
        </label>
      </div>
    </div>
  );
}
