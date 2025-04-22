'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import L from 'leaflet';

interface MapControlsProps {
  map: L.Map;
  overlay: L.Layer | null;
  markers: L.LayerGroup | null;
  polygon: L.Layer | null;
}

export default function MapControls({
  map,
  overlay,
  markers,
  polygon,
}: MapControlsProps) {
  const [opacity, setOpacity] = useState(0.7);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showPolygon, setShowPolygon] = useState(true);
  const [baseLayer, setBaseLayer] = useState('osm');

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
  };

  useEffect(() => {
    if (!map) return;
    const selected = baseLayers[baseLayer as keyof typeof baseLayers];
    selected.addTo(map);

    return () => {
      map.eachLayer((layer) => {
        if (layer !== overlay && layer !== markers && layer !== polygon) {
          map.removeLayer(layer);
        }
      });
    };
  }, [baseLayer]);

  function handleOpacityChange(e: ChangeEvent<HTMLInputElement>) {
    const value = parseFloat(e.target.value);
    setOpacity(value);
    if (overlay && overlay instanceof L.TileLayer) {
      overlay.setOpacity(value);
    }
  }

  return (
    <div className="absolute top-4 right-4 z-50 w-64 bg-white border border-border rounded-lg shadow-lg p-4 space-y-4 text-sm text-foreground">
      <div className="space-y-1">
        <label htmlFor="base-layer" className="block font-medium">
          Base layer
        </label>
        <select
          id="base-layer"
          value={baseLayer}
          onChange={(e) => setBaseLayer(e.target.value)}
          className="w-full border border-input bg-background rounded-md px-3 py-2"
        >
          <option value="osm">OpenStreetMap</option>
          <option value="esri">ESRI World Imagery</option>
          <option value="topo">OpenTopoMap</option>
        </select>
      </div>

      <div className="space-y-1">
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
          onChange={handleOpacityChange}
          className="w-full"
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          id="gcp-toggle"
          type="checkbox"
          checked={showMarkers}
          onChange={(e) => {
            const visible = e.target.checked;
            setShowMarkers(visible);
            if (markers)
              visible ? markers.addTo(map) : map.removeLayer(markers);
          }}
        />
        <label htmlFor="gcp-toggle" className="text-sm">
          Show GCP markers
        </label>
      </div>

      <div className="flex items-center space-x-2">
        <input
          id="outline-toggle"
          type="checkbox"
          checked={showPolygon}
          onChange={(e) => {
            const visible = e.target.checked;
            setShowPolygon(visible);
            if (polygon)
              visible ? polygon.addTo(map) : map.removeLayer(polygon);
          }}
        />
        <label htmlFor="outline-toggle" className="text-sm">
          Show outline
        </label>
      </div>
    </div>
  );
}
