'use client';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { GavocLocation } from '@/lib/gavoc/types';
import {
  Circle,
  Globe,
  Layers,
  Loader2,
  MapPin,
  Navigation,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

declare global {
  interface Window {
    L: any;
  }
}

interface GavocMapProps {
  locations: GavocLocation[];
  selectedLocationId: string | null;
  onLocationSelect: (locationId: string | null) => void;
  triggerResize?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  'plaats/settlement': '#1f77b4',
  'eiland/island': '#ff7f0e',
  'rivier/river': '#2ca02c',
  'kaap/cape': '#9467bd',
  'landstreek/region': '#7f7f7f',
  'baai/bay': '#8c564b',
  'eilanden/islands': '#ff8c42',
  'fort/fortress': '#aec7e8',
  'berg/mountain': '#d62728',
  'ondiepte/shoals': '#98df8a',
  'zeestraat/strait': '#17becf',
  'provincie/province': '#c5b0d5',
  'schiereiland/peninsula': '#e377c2',
  'gebouw/building': '#ff9896',
  unknown: '#bcbd22',
};

const TILE_LAYERS = {
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  },
  terrain: {
    name: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
  },
};

const DEFAULT_FALLBACK_COLOR = '#666666';

export default function GavocMap({
  locations,
  selectedLocationId,
  onLocationSelect,
  triggerResize,
}: GavocMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerClusterGroup = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const legendControl = useRef<any>(null);
  const L = useRef<any>(null);

  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [currentTileLayer, setCurrentTileLayer] = useState('osm');
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [mapStats, setMapStats] = useState({
    totalPoints: 0,
    visiblePoints: 0,
    categories: 0,
  });

  const mappableLocations = useMemo(() => {
    return locations.filter((location) => location.hasCoordinates);
  }, [locations]);

  const activeCategoryStyles = useMemo(() => {
    const styles: Record<string, { color: string }> = {};
    const usedColors = new Set<string>();

    const categories = Array.from(
      new Set(mappableLocations.map((l) => l.category)),
    ).sort();

    categories.forEach((category, index) => {
      const predefinedColor = CATEGORY_COLORS[category.toLowerCase()];
      if (predefinedColor && !usedColors.has(predefinedColor)) {
        styles[category] = { color: predefinedColor };
        usedColors.add(predefinedColor);
      } else {
        // Generate dynamic color
        const hue = (index * 137.508) % 360;
        const color = `hsl(${Math.floor(hue)}, 70%, 50%)`;
        styles[category] = { color: color };
        usedColors.add(color);
      }
    });

    return styles;
  }, [mappableLocations]);

  const createCategoryIcon = useCallback(
    (color: string, isSelected: boolean = false) => {
      if (!L.current) return null;

      const size = isSelected ? 14 : 10;
      const borderWidth = isSelected ? 3 : 2;

      return new L.current.DivIcon({
        className: `gavoc-marker-icon ${isSelected ? 'selected' : ''}`,
        html: `<div style="
        background: ${color};
        border: ${borderWidth}px solid #ffffff;
        border-radius: 50%;
        width: ${size}px;
        height: ${size}px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        transform: translate(-50%, -50%);
      "></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
    },
    [],
  );

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    const initMap = async () => {
      try {
        const leaflet = await import('leaflet');
        L.current = leaflet.default;

        await import('leaflet.markercluster');

        if (mapContainer.current) {
          mapContainer.current.innerHTML = '';
          (mapContainer.current as any)._leaflet_id = null;
        }

        const map = L.current.map(mapContainer.current, {
          center: [20, 0],
          zoom: 2,
          zoomControl: false,
        });

        L.current
          .tileLayer(TILE_LAYERS.osm.url, {
            attribution: TILE_LAYERS.osm.attribution,
          })
          .addTo(map);

        markerClusterGroup.current = L.current.markerClusterGroup({
          maxClusterRadius: 50,
          disableClusteringAtZoom: 18,
          iconCreateFunction: function (cluster: any) {
            const count = cluster.getChildCount();
            const size = count < 10 ? 40 : count < 100 ? 50 : 60;

            return new L.current.DivIcon({
              html: `<div style="
                background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 50%, #e2e8f0 100%);
                border: 3px solid #475569;
                border-radius: 50%;
                width: ${size}px;
                height: ${size}px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                font-size: ${
                  count < 10 ? '12px' : count < 100 ? '14px' : '16px'
                };
                color: #1e293b;
                box-shadow: 0 6px 20px rgba(71, 85, 105, 0.15);
              ">${count}</div>`,
              className: 'gavoc-cluster-icon',
              iconSize: [size, size],
            });
          },
        });

        map.addLayer(markerClusterGroup.current);
        mapInstance.current = map;
        setIsMapInitialized(true);
        setIsMapLoading(false);
      } catch (error) {
        console.error('Failed to initialize map:', error);
        setIsMapLoading(false);
      }
    };

    initMap();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markerClusterGroup.current = null;
        L.current = null;
        setIsMapInitialized(false);
        setIsMapLoading(true);

        // Clear the container
        if (mapContainer.current) {
          mapContainer.current.innerHTML = '';
          (mapContainer.current as any)._leaflet_id = null;
        }
      }
    };
  }, []);

  const switchTileLayer = useCallback((layerKey: string) => {
    if (
      mapInstance.current &&
      L.current &&
      TILE_LAYERS[layerKey as keyof typeof TILE_LAYERS]
    ) {
      const layer = TILE_LAYERS[layerKey as keyof typeof TILE_LAYERS];

      mapInstance.current.eachLayer((layer: any) => {
        if (layer instanceof L.current.TileLayer) {
          mapInstance.current?.removeLayer(layer);
        }
      });

      L.current
        .tileLayer(layer.url, {
          attribution: layer.attribution,
        })
        .addTo(mapInstance.current);

      setCurrentTileLayer(layerKey);
    }
  }, []);

  const toggleClustering = useCallback(() => {
    if (mapInstance.current && markerClusterGroup.current) {
      const markers = Object.values(markersRef.current);

      if (showClusters) {
        markerClusterGroup.current.clearLayers();
        markers.forEach((marker) => mapInstance.current?.addLayer(marker));
      } else {
        markers.forEach((marker) => mapInstance.current?.removeLayer(marker));
        markerClusterGroup.current.addLayers(markers);
      }

      setShowClusters(!showClusters);
    }
  }, [showClusters]);

  const handleZoomIn = useCallback(() => {
    mapInstance.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapInstance.current?.zoomOut();
  }, []);

  const handleResetView = useCallback(() => {
    if (mapInstance.current && markerClusterGroup.current) {
      try {
        const bounds = markerClusterGroup.current.getBounds();
        if (bounds.isValid()) {
          mapInstance.current.fitBounds(bounds, {
            padding: [20, 20],
            maxZoom: 16,
          });
        } else {
          mapInstance.current.setView([20, 0], 2);
        }
      } catch (e) {
        mapInstance.current.setView([20, 0], 2);
      }
    }
  }, []);

  useEffect(() => {
    if (
      !isMapInitialized ||
      !mapInstance.current ||
      !markerClusterGroup.current ||
      !L.current
    )
      return;

    Object.values(markersRef.current).forEach((marker) => {
      mapInstance.current?.removeLayer(marker);
    });
    markerClusterGroup.current.clearLayers();
    markersRef.current = {};

    const leafletMarkers: any[] = [];

    mappableLocations.forEach((location) => {
      if (!location.latitude || !location.longitude) return;

      const categoryStyle = activeCategoryStyles[location.category];
      const color = categoryStyle?.color || DEFAULT_FALLBACK_COLOR;

      const marker = L.current.marker([location.latitude, location.longitude], {
        icon: createCategoryIcon(color, selectedLocationId === location.id),
        title: location.category,
      });

      // Create popup content
      marker.bindPopup(`
        <div style="font-family: 'Inter', system-ui, sans-serif; font-size: 14px; max-width: 280px; color: #44403c;">
          <div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e7e5e4;">
            <strong style="display: block; margin-bottom: 4px; font-size: 16px; color: #1c1917; font-weight: 600; line-height: 1.3;">
              ${location.originalNameOnMap || location.presentName}
            </strong>
            ${
              location.presentName &&
              location.presentName !== location.originalNameOnMap
                ? `<div style="color: #78716c; font-size: 13px;">Present: ${location.presentName}</div>`
                : ''
            }
          </div>
          <div style="space-y: 6px;">
            <div style="margin-bottom: 6px;">
              <strong style="color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Category:</strong>
              <span style="margin-left: 6px; color: #57534e; font-weight: 500;">${
                location.category
              }</span>
            </div>
            <div style="margin-bottom: 6px;">
              <strong style="color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Coordinates:</strong>
              <span style="margin-left: 6px; color: #57534e; font-family: 'Source Code Pro', monospace; font-size: 13px;">${location.latitude.toFixed(
                4,
              )}, ${location.longitude.toFixed(4)}</span>
            </div>
            <div style="margin-bottom: 6px;">
              <strong style="color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Map:</strong>
              <span style="margin-left: 6px; color: #57534e; font-size: 13px;">${
                location.map
              } (${location.page})</span>
            </div>
            <div style="margin-bottom: 0;">
              <strong style="color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">URI:</strong>
              <span style="margin-left: 6px; color: #57534e; font-family: 'Source Code Pro', monospace; font-size: 11px; background: #f5f5f4; padding: 2px 4px; border-radius: 3px;">${
                location.uri
              }</span>
            </div>
          </div>
        </div>
      `);

      marker.bindTooltip(
        `${location.originalNameOnMap || location.presentName} (${
          location.category
        })`,
        {
          direction: 'top',
          offset: [0, -10],
          className: 'gavoc-tooltip',
          opacity: 0.95,
        },
      );

      marker.on('click', () => {
        onLocationSelect(location.id);
      });

      markersRef.current[location.id] = marker;
      leafletMarkers.push(marker);
    });

    if (leafletMarkers.length > 0) {
      if (showClusters) {
        markerClusterGroup.current.addLayers(leafletMarkers);
      } else {
        leafletMarkers.forEach((marker) =>
          mapInstance.current?.addLayer(marker),
        );
      }

      try {
        const group = new L.current.FeatureGroup(leafletMarkers);
        const bounds = group.getBounds();
        if (bounds.isValid()) {
          mapInstance.current.fitBounds(bounds, {
            padding: [40, 40],
            maxZoom: 16,
          });
        }
      } catch (e) {}
    }

    setMapStats({
      totalPoints: mappableLocations.length,
      visiblePoints: leafletMarkers.length,
      categories: Object.keys(activeCategoryStyles).length,
    });
  }, [
    mappableLocations,
    isMapInitialized,
    activeCategoryStyles,
    createCategoryIcon,
    selectedLocationId,
    onLocationSelect,
    showClusters,
  ]);

  useEffect(() => {
    if (!isMapInitialized || !selectedLocationId || !L.current) return;

    const marker = markersRef.current[selectedLocationId];
    if (marker) {
      const location = mappableLocations.find(
        (l) => l.id === selectedLocationId,
      );
      if (location) {
        const categoryStyle = activeCategoryStyles[location.category];
        const color = categoryStyle?.color || DEFAULT_FALLBACK_COLOR;
        marker.setIcon(createCategoryIcon(color, true));

        const targetLatLng = marker.getLatLng();
        mapInstance.current?.setView(targetLatLng, 12);
        marker.openPopup();
      }
    }

    Object.values(markersRef.current).forEach((m) => {
      if (m !== marker) {
        const locationData = mappableLocations.find(
          (l) => markersRef.current[l.id] === m,
        );
        if (locationData) {
          const catStyle = activeCategoryStyles[locationData.category];
          const color = catStyle?.color || DEFAULT_FALLBACK_COLOR;
          m.setIcon(createCategoryIcon(color, false));
        }
      }
    });
  }, [
    selectedLocationId,
    isMapInitialized,
    activeCategoryStyles,
    mappableLocations,
    createCategoryIcon,
  ]);

  useEffect(() => {
    if (!isMapInitialized || !mapInstance.current || !L.current) return;

    if (legendControl.current) {
      mapInstance.current.removeControl(legendControl.current);
    }

    const sortedCategories = Object.keys(activeCategoryStyles).sort();

    if (sortedCategories.length > 0) {
      const legend = new L.current.Control({ position: 'bottomright' });
      legend.onAdd = () => {
        const div = L.current.DomUtil.create('div', 'gavoc-legend');
        div.style.backgroundColor = 'rgba(250, 250, 249, 0.95)';
        div.style.backdropFilter = 'blur(8px)';
        div.style.padding = '12px 16px';
        div.style.borderRadius = '12px';
        div.style.border = '1px solid rgba(231, 229, 228, 0.6)';
        div.style.boxShadow = '0 4px 12px rgba(101, 79, 60, 0.15)';
        div.style.maxWidth = '200px';
        div.style.fontFamily = "'Inter', system-ui, sans-serif";
        div.style.marginBottom = '80px';

        const header = L.current.DomUtil.create('div', '', div);
        header.style.cursor = 'pointer';
        header.style.marginBottom = isLegendOpen ? '8px' : '0';
        header.style.fontWeight = '600';
        header.style.fontSize = '14px';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.color = '#57534e';
        header.innerHTML = `<span>Categories</span><span style="font-size: 1.1em; color: #d97706;">${
          isLegendOpen ? '▼' : '▶'
        }</span>`;

        const content = L.current.DomUtil.create('div', '', div);
        content.style.maxHeight = '160px';
        content.style.overflowY = 'auto';
        content.style.display = isLegendOpen ? 'block' : 'none';

        L.current.DomEvent.disableClickPropagation(div);
        L.current.DomEvent.disableScrollPropagation(div);

        header.onclick = (e: any) => {
          e.stopPropagation();
          setIsLegendOpen(!isLegendOpen);
        };

        if (isLegendOpen) {
          let legendHtml = '';
          sortedCategories.forEach((category) => {
            const color =
              activeCategoryStyles[category]?.color || DEFAULT_FALLBACK_COLOR;
            const count = mappableLocations.filter(
              (l) => l.category === category,
            ).length;
            legendHtml += `
              <div style="display: flex; align-items: center; margin-bottom: 6px; font-size: 12px;">
                <div style="width: 12px; height: 12px; background: ${color}; border-radius: 50%; margin-right: 8px; border: 1px solid rgba(0,0,0,0.1);"></div>
                <span style="color: #44403c; flex: 1;">${category}</span>
                <span style="color: #78716c; font-weight: 500;">${count}</span>
              </div>
            `;
          });
          content.innerHTML = legendHtml;
        }

        return div;
      };

      mapInstance.current.addControl(legend);
      legendControl.current = legend;
    }
  }, [isMapInitialized, activeCategoryStyles, isLegendOpen, mappableLocations]);

  useEffect(() => {
    if (!isMapInitialized || !mapInstance.current || !triggerResize) return;

    const timeoutId = setTimeout(() => {
      try {
        mapInstance.current.invalidateSize();
      } catch (error) {
        console.warn('Map resize failed:', error);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [triggerResize, isMapInitialized]);

  return (
    <div className="relative w-full h-full">
      {isMapLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-amber-50 to-stone-100 z-[1050] flex items-center justify-center">
          <div className="text-center space-y-6">
            <div className="relative">
              <Globe className="h-16 w-16 text-amber-600 mx-auto animate-pulse" />
              <Loader2 className="absolute inset-0 h-16 w-16 text-amber-500 animate-spin" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-serif font-semibold text-stone-800 tracking-wide">
                Initializing GAVOC Atlas
              </h3>
              <p className="text-sm text-stone-600 font-medium">
                Loading historical geographic data...
              </p>
            </div>
          </div>
        </div>
      )}

      <div ref={mapContainer} className="w-full h-full" />

      {isMapInitialized && !isMapLoading && (
        <>
          <div className="absolute top-4 left-4 z-[1040] flex items-center space-x-3">
            <div className="bg-stone-50/95 backdrop-blur-sm rounded-xl shadow-lg px-4 py-3 border border-stone-200/60">
              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-amber-700" />
                  <span className="font-semibold text-stone-700">
                    {mapStats.visiblePoints}
                  </span>
                  <span className="text-stone-500 font-medium">locations</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Layers className="h-4 w-4 text-amber-700" />
                  <span className="font-semibold text-stone-700">
                    {mapStats.categories}
                  </span>
                  <span className="text-stone-500 font-medium">categories</span>
                </div>
              </div>
            </div>

            <div className="bg-stone-50/95 backdrop-blur-sm rounded-xl shadow-lg border border-stone-200/60 overflow-hidden">
              <div className="flex">
                {Object.entries(TILE_LAYERS).map(([key, layer]) => (
                  <button
                    key={key}
                    onClick={() => switchTileLayer(key)}
                    className={`px-4 py-3 text-xs font-semibold transition-all duration-200 ${
                      currentTileLayer === key
                        ? 'bg-amber-600 text-amber-50 shadow-sm'
                        : 'text-stone-600 hover:text-stone-800 hover:bg-stone-100/60'
                    }`}
                    title={`Switch to ${layer.name}`}
                  >
                    {layer.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute top-4 right-4 z-[1040] flex flex-col space-y-3">
            <div className="bg-stone-50/95 backdrop-blur-sm rounded-xl shadow-lg border border-stone-200/60 overflow-hidden">
              <div className="flex flex-col">
                <button
                  onClick={handleZoomIn}
                  className="p-3 text-stone-600 hover:text-stone-800 hover:bg-stone-100/60 transition-all duration-200 border-b border-stone-200/60"
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-3 text-stone-600 hover:text-stone-800 hover:bg-stone-100/60 transition-all duration-200 border-b border-stone-200/60"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  onClick={handleResetView}
                  className="p-3 text-stone-600 hover:text-stone-800 hover:bg-stone-100/60 transition-all duration-200"
                  title="Reset View"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="bg-stone-50/95 backdrop-blur-sm rounded-xl shadow-lg border border-stone-200/60 overflow-hidden">
              <button
                onClick={toggleClustering}
                className={`p-3 transition-all duration-200 ${
                  showClusters
                    ? 'text-amber-700 bg-amber-100/60'
                    : 'text-stone-600 hover:text-stone-800 hover:bg-stone-100/60'
                }`}
                title={
                  showClusters ? 'Disable Clustering' : 'Enable Clustering'
                }
              >
                <Circle className="h-4 w-4" />
              </button>
            </div>
          </div>

          {mappableLocations.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 z-[1040]">
              <div className="bg-stone-50/95 backdrop-blur-sm rounded-xl shadow-lg px-6 py-3 border border-stone-200/60">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <Navigation className="h-4 w-4 text-amber-700" />
                      <span className="text-stone-700 font-medium">
                        {
                          TILE_LAYERS[
                            currentTileLayer as keyof typeof TILE_LAYERS
                          ].name
                        }{' '}
                        View
                      </span>
                    </div>
                    <div className="h-4 w-px bg-stone-300/80" />
                    <div className="text-stone-600 font-medium">
                      {showClusters ? 'Clustered' : 'Individual'} markers
                    </div>
                  </div>
                  <div className="text-stone-500 font-medium">
                    Click markers for details • Drag to explore
                  </div>
                </div>
              </div>
            </div>
          )}

          {mappableLocations.length === 0 && (
            <div className="absolute inset-0 bg-stone-100/60 z-[1030] flex items-center justify-center">
              <div className="bg-stone-50/95 backdrop-blur-sm p-10 rounded-2xl shadow-lg text-center space-y-6 max-w-md mx-4 border border-stone-200/60">
                <div className="p-4 bg-amber-100/60 rounded-2xl w-fit mx-auto">
                  <MapPin className="h-10 w-10 text-amber-700" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-serif font-semibold text-stone-800 tracking-wide">
                    No Geographic Data
                  </h3>
                  <p className="text-sm text-stone-600 font-medium leading-relaxed">
                    Add coordinate data to visualize locations on this
                    historical atlas interface.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
