'use client';

import { cn } from '@/lib/utils';
import L from 'leaflet';
import { Menu, X } from 'lucide-react';
import { ChangeEvent, useEffect, useState } from 'react';

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
        className="
          absolute top-4 right-4 z-[1001]
          p-2 bg-card/90 backdrop-blur-sm border border-border
          rounded-lg shadow hover:bg-card transition text-foreground
        "
        aria-label="Open map controls"
      >
        <Menu className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        `
          absolute top-4 right-4 z-[1001] w-72
          bg-card/95 backdrop-blur-sm border border-border
          rounded-xl shadow-lg p-4 space-y-4 text-sm text-card-foreground
        `,
      )}
    >
      <button
        onClick={() => setCollapsed(true)}
        className="absolute top-2 right-2 p-1 rounded hover:bg-muted transition text-muted-foreground hover:text-foreground"
        aria-label="Close map controls"
      >
        <X className="h-4 w-4" />
      </button>

      <div>
        <label
          htmlFor="base-layer"
          className="block text-sm font-medium text-foreground"
        >
          Base layer
        </label>
        <select
          id="base-layer"
          value={baseLayer}
          onChange={(e) => setBaseLayer(e.target.value as any)}
          className="
            mt-1 block w-full rounded-md border border-border
            bg-card py-2 px-3 text-sm text-card-foreground
            focus:outline-none focus:ring-2 focus:ring-primary
            focus:border-primary
          "
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
        <label
          htmlFor="opacity"
          className="block text-sm font-medium text-foreground"
        >
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
          className="mt-1 w-full accent-primary"
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          id="gcp-toggle"
          type="checkbox"
          checked={showMarkers}
          onChange={(e) => toggleMarkers(e.target.checked)}
          className="h-4 w-4 accent-primary focus:ring-primary"
        />
        <label htmlFor="gcp-toggle" className="text-sm text-foreground">
          Show markers
        </label>
      </div>

      <div className="flex items-center space-x-2">
        <input
          id="outline-toggle"
          type="checkbox"
          checked={showPolygon}
          onChange={(e) => togglePolygon(e.target.checked)}
          className="h-4 w-4 accent-primary focus:ring-primary"
        />
        <label htmlFor="outline-toggle" className="text-sm text-foreground">
          Show outline
        </label>
      </div>
    </div>
  );
}
