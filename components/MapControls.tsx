'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import L from 'leaflet';
import { cn } from '@/lib/utils';

interface MapControlsProps {
  map: L.Map;
  overlay: L.Layer;
  markers: L.LayerGroup;
  polygon: L.Layer;
  opacity: number;
  onOpacityChange: (v: number) => void;
}

export function MapControls({
  map,
  overlay,
  markers,
  polygon,
  opacity,
  onOpacityChange,
}: MapControlsProps) {
  const [showMarkers, setShowMarkers] = useState(true);
  const [showPolygon, setShowPolygon] = useState(false);
  const [baseLayer, setBaseLayer] = useState<
    'osm' | 'esri' | 'topo' | 'cartoVoyagerLabelsUnder'
  >('cartoVoyagerLabelsUnder');
  const [collapsed, setCollapsed] = useState(true);
  const [currentBaseLayer, setCurrentBaseLayer] = useState<L.TileLayer | null>(
    null,
  );

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
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    ),
  };

  useEffect(() => {
    const newBase = baseLayers[baseLayer];
    newBase.addTo(map);
    if (currentBaseLayer && currentBaseLayer !== newBase) {
      map.removeLayer(currentBaseLayer);
    }
    setCurrentBaseLayer(newBase);
  }, [baseLayer, map]);

  function onOpacityInput(e: ChangeEvent<HTMLInputElement>) {
    onOpacityChange(parseFloat(e.target.value));
  }

  function toggleMarkers(v: boolean) {
    setShowMarkers(v);
    v ? markers.addTo(map) : map.removeLayer(markers);
  }

  function togglePolygon(v: boolean) {
    setShowPolygon(v);
    v ? polygon.addTo(map) : map.removeLayer(polygon);
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute top-4 right-4 z-[10000] p-2 bg-white border border-border rounded-md shadow hover:bg-gray-50"
        aria-label="Show map controls"
      >
        ☰
      </button>
    );
  }

  return (
    <div
      className={cn(
        'absolute top-4 right-4 z-[10000] w-64 bg-white border border-border rounded-lg shadow-lg p-4 space-y-4 text-sm text-foreground',
      )}
    >
      <button
        onClick={() => setCollapsed(true)}
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        aria-label="Hide map controls"
      >
        ×
      </button>

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
          onChange={onOpacityInput}
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
