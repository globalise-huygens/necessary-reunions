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
  isMobile?: boolean;
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
  isMobile = false,
}: GavocMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerClusterGroup = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const legendControl = useRef<any>(null);
  const L = useRef<any>(null);

  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [showClusters, setShowClusters] = useState(true);
  const [currentTileLayer, setCurrentTileLayer] = useState('osm');
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [mapStats, setMapStats] = useState({
    totalPoints: 0,
    visiblePoints: 0,
    categories: 0,
  });

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

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
      if (!L.current) {
        console.warn('Leaflet not loaded when creating icon');
        return null;
      }

      const size = isSelected ? 16 : 12;

      try {
        const icon = new L.current.DivIcon({
          className: 'gavoc-simple-marker',
          html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border: 2px solid white;"></div>`,
          iconSize: [size + 4, size + 4],
          iconAnchor: [(size + 4) / 2, (size + 4) / 2],
          popupAnchor: [0, -((size + 4) / 2)],
        });
        return icon;
      } catch (error) {
        console.warn('Error creating category icon:', error);
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    if (!isMounted || !mapContainer.current || mapInstance.current) return;

    const initMap = async () => {
      try {
        if (!mapContainer.current) {
          console.warn('Map container not available');
          return;
        }

        const container = mapContainer.current;
        if (container.offsetWidth === 0 || container.offsetHeight === 0) {
          setTimeout(initMap, 100);
          return;
        }

        if (!container.isConnected) {
          setTimeout(initMap, 100);
          return;
        }

        const leaflet = await import('leaflet');
        L.current = leaflet.default;

        await import('leaflet.markercluster');

        if (mapContainer.current) {
          mapContainer.current.innerHTML = '';
          (mapContainer.current as any)._leaflet_id = null;
        }

        if (!mapContainer.current || mapContainer.current.offsetWidth === 0) {
          console.warn('Container not ready for map initialization');
          setTimeout(initMap, 100);
          return;
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
          disableClusteringAtZoom: 14,
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

        map.on('click', (e: any) => {
          if (!e.layer) {
            onLocationSelect(null);
          }
        });

        mapInstance.current = map;
        setIsMapInitialized(true);
        setIsMapLoading(false);
      } catch (error) {
        console.error('Failed to initialize map:', error);
        setIsMapLoading(false);

        if (mapContainer.current) {
          mapContainer.current.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: #f5f5f4; color: #57534e; font-family: 'Inter', sans-serif;">
              <div style="text-align: center; padding: 2rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">MAP</div>
                <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">Map initialization failed</h3>
                <p style="font-size: 0.875rem; margin-bottom: 1rem;">Unable to load the interactive map component.</p>
                <button onclick="window.location.reload()" style="background: #d97706; color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem;">
                  Reload Page
                </button>
              </div>
            </div>
          `;
        }
      }
    };

    initMap();

    return () => {
      try {
        if (legendControl.current && mapInstance.current) {
          mapInstance.current.removeControl(legendControl.current);
          legendControl.current = null;
        }

        if (markerClusterGroup.current && mapInstance.current) {
          mapInstance.current.removeLayer(markerClusterGroup.current);
          markerClusterGroup.current = null;
        }

        Object.values(markersRef.current).forEach((marker) => {
          try {
            if (marker && mapInstance.current) {
              mapInstance.current.removeLayer(marker);
            }
          } catch (error) {
            console.warn('Error removing marker:', error);
          }
        });
        markersRef.current = {};

        if (mapInstance.current) {
          mapInstance.current.off();
          mapInstance.current.remove();
          mapInstance.current = null;
        }

        L.current = null;
        setIsMapInitialized(false);
        setIsMapLoading(true);

        if (mapContainer.current) {
          mapContainer.current.innerHTML = '';
          (mapContainer.current as any)._leaflet_id = null;
        }
      } catch (error) {
        console.warn('Error during map cleanup:', error);
        mapInstance.current = null;
        markerClusterGroup.current = null;
        L.current = null;
        markersRef.current = {};
        setIsMapInitialized(false);
        setIsMapLoading(true);
      }
    };
  }, [isMounted]);

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
    if (
      !mapInstance.current ||
      !markerClusterGroup.current ||
      !mapContainer.current ||
      mapContainer.current.offsetWidth === 0
    )
      return;

    try {
      const markers = Object.values(markersRef.current);

      if (showClusters) {
        if (mapInstance.current.hasLayer(markerClusterGroup.current)) {
          mapInstance.current.removeLayer(markerClusterGroup.current);
        }
        markerClusterGroup.current.clearLayers();

        markers.forEach((marker) => {
          try {
            if (!mapInstance.current.hasLayer(marker)) {
              mapInstance.current.addLayer(marker);
            }
          } catch (error) {
            console.warn('Failed to add individual marker:', error);
          }
        });
      } else {
        markers.forEach((marker) => {
          try {
            if (mapInstance.current.hasLayer(marker)) {
              mapInstance.current.removeLayer(marker);
            }
          } catch (error) {
            console.warn('Failed to remove individual marker:', error);
          }
        });

        markerClusterGroup.current.addLayers(markers);
        markerClusterGroup.current.refreshClusters();

        if (!mapInstance.current.hasLayer(markerClusterGroup.current)) {
          mapInstance.current.addLayer(markerClusterGroup.current);
        }
      }

      setShowClusters(!showClusters);
    } catch (error) {
      console.warn('Toggle clustering failed:', error);
    }
  }, [showClusters]);

  const handleZoomIn = useCallback(() => {
    try {
      if (
        mapInstance.current &&
        mapContainer.current &&
        mapContainer.current.offsetWidth > 0
      ) {
        mapInstance.current.zoomIn();
      }
    } catch (error) {
      console.warn('Zoom in failed:', error);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    try {
      if (
        mapInstance.current &&
        mapContainer.current &&
        mapContainer.current.offsetWidth > 0
      ) {
        mapInstance.current.zoomOut();
      }
    } catch (error) {
      console.warn('Zoom out failed:', error);
    }
  }, []);

  const handleResetView = useCallback(() => {
    if (
      !mapInstance.current ||
      !mapContainer.current ||
      mapContainer.current.offsetWidth === 0
    )
      return;

    try {
      if (markerClusterGroup.current) {
        const bounds = markerClusterGroup.current.getBounds();
        if (bounds.isValid()) {
          mapInstance.current.fitBounds(bounds, {
            padding: [20, 20],
            maxZoom: 6,
          });
        } else {
          mapInstance.current.setView([20, 0], 2);
        }
      } else {
        mapInstance.current.setView([20, 0], 2);
      }
    } catch (e) {
      console.warn('Reset view failed:', e);
      try {
        if (mapInstance.current && mapContainer.current.offsetWidth > 0) {
          mapInstance.current.setView([20, 0], 2);
        }
      } catch (fallbackError) {
        console.warn('Fallback reset view failed:', fallbackError);
      }
    }
  }, []);

  useEffect(() => {
    if (
      !isMapInitialized ||
      !mapInstance.current ||
      !markerClusterGroup.current ||
      !L.current
    ) {
      return;
    }

    Object.values(markersRef.current).forEach((marker) => {
      try {
        if (mapInstance.current?.hasLayer(marker)) {
          mapInstance.current.removeLayer(marker);
        }
      } catch (error) {
        console.warn('Error removing marker:', error);
      }
    });

    if (markerClusterGroup.current) {
      markerClusterGroup.current.clearLayers();
      if (mapInstance.current.hasLayer(markerClusterGroup.current)) {
        mapInstance.current.removeLayer(markerClusterGroup.current);
      }
    }

    markersRef.current = {};

    const leafletMarkers: any[] = [];

    mappableLocations.forEach((location, index) => {
      if (!location.latitude || !location.longitude) {
        return;
      }

      if (markersRef.current[location.id]) {
        console.warn('Duplicate marker detected for location:', location.id);
        return;
      }

      const categoryStyle = activeCategoryStyles[location.category];
      const color = categoryStyle?.color || DEFAULT_FALLBACK_COLOR;

      const icon = createCategoryIcon(color, false);

      const marker = L.current.marker([location.latitude, location.longitude], {
        icon: icon,
        title: location.category,
      });

      marker.bindPopup(
        `
        <div style="font-family: 'Inter', system-ui, sans-serif; font-size: 13px; color: #44403c; width: 260px;">
          <div style="margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e7e5e4;">
            <strong style="display: block; font-size: 15px; color: #1c1917; font-weight: 600; line-height: 1.2; margin-bottom: 2px;">
              ${location.originalNameOnMap || location.presentName}
            </strong>
            ${
              location.presentName &&
              location.presentName !== location.originalNameOnMap
                ? `<div style="color: #78716c; font-size: 12px;">Present: ${location.presentName}</div>`
                : ''
            }
          </div>
          <div style="line-height: 1.4;">
            <div style="margin-bottom: 4px;">
              <strong style="color: #78716c; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em;">Category:</strong>
              <span style="color: #57534e; margin-left: 4px;">${
                location.category
              }</span>
            </div>
            <div style="margin-bottom: 4px;">
              <strong style="color: #78716c; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em;">Coordinates:</strong>
              <span style="color: #57534e; font-family: 'Source Code Pro', monospace; font-size: 12px; margin-left: 4px;">${location.latitude.toFixed(
                4,
              )}, ${location.longitude.toFixed(4)}</span>
            </div>
            <div style="margin-bottom: 6px;">
              <strong style="color: #78716c; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em;">Map:</strong>
              <span style="color: #57534e; margin-left: 4px;">${
                location.map
              } (${location.page})</span>
            </div>
            <div>
              <strong style="color: #78716c; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; display: block; margin-bottom: 2px;">URI:</strong>
              <div style="display: flex; align-items: center; gap: 4px;">
                <div style="background: #f5f5f4; padding: 4px 6px; border-radius: 4px; font-family: 'Source Code Pro', monospace; font-size: 10px; color: #57534e; word-break: break-all; line-height: 1.3; flex: 1;">${
                  location.uri
                }</div>
                <button
                  onclick="navigator.clipboard.writeText('${
                    location.uri
                  }').then(() => {
                    const btn = event.target;
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '✓';
                    btn.style.color = '#16a34a';
                    setTimeout(() => {
                      btn.innerHTML = originalText;
                      btn.style.color = '#78716c';
                    }, 1500);
                  })"
                  style="background: #f5f5f4; border: 1px solid #e7e5e4; padding: 2px 6px; border-radius: 3px; font-size: 10px; color: #78716c; cursor: pointer; white-space: nowrap; font-family: 'Inter', sans-serif; font-weight: 500;"
                  title="Copy URI"
                >
                  📋
                </button>
              </div>
            </div>
          </div>
        </div>
      `,
        {
          maxWidth: 280,
          minWidth: 260,
          className: 'gavoc-popup',
        },
      );

      marker.on('click', (e: any) => {
        e.originalEvent?.stopPropagation();
        onLocationSelect(location.id);
      });

      markersRef.current[location.id] = marker;
      leafletMarkers.push(marker);
    });

    if (leafletMarkers.length > 0) {
      if (showClusters) {
        markerClusterGroup.current.addLayers(leafletMarkers);
        markerClusterGroup.current.refreshClusters();

        if (!mapInstance.current.hasLayer(markerClusterGroup.current)) {
          mapInstance.current.addLayer(markerClusterGroup.current);
        }
      } else {
        leafletMarkers.forEach((marker) => {
          try {
            mapInstance.current?.addLayer(marker);
          } catch (error) {
            console.warn('Failed to add individual marker:', error);
          }
        });
      }

      try {
        const group = new L.current.FeatureGroup(leafletMarkers);
        const bounds = group.getBounds();

        if (
          bounds.isValid() &&
          mapContainer.current &&
          mapContainer.current.offsetWidth > 0 &&
          !selectedLocationId
        ) {
          mapInstance.current.fitBounds(bounds, {
            padding: [40, 40],
            maxZoom: 8,
          });

          setTimeout(() => {
            if (!mapInstance.current || !mapContainer.current) return;

            try {
              const currentZoom = mapInstance.current.getZoom();

              if (currentZoom <= 1 && mappableLocations.length > 0) {
                const sampleLocation = mappableLocations[0];
                mapInstance.current.setView(
                  [sampleLocation.latitude, sampleLocation.longitude],
                  4,
                );
              }
            } catch (zoomError) {
              console.warn(
                'Failed to adjust zoom after bounds fit:',
                zoomError,
              );
            }
          }, 200);
        }
      } catch (e) {
        console.warn('Error fitting bounds:', e);
      }
    }

    setMapStats({
      totalPoints: mappableLocations.length,
      visiblePoints: leafletMarkers.length,
      categories: Object.keys(activeCategoryStyles).length,
    });
  }, [mappableLocations, isMapInitialized, createCategoryIcon, showClusters]);

  useEffect(() => {
    if (!isMapInitialized || !L.current || !mapInstance.current) return;

    Object.entries(markersRef.current).forEach(([locationId, marker]) => {
      const locationData = mappableLocations.find((l) => l.id === locationId);
      if (locationData) {
        const categoryStyle = activeCategoryStyles[locationData.category];
        const color = categoryStyle?.color || DEFAULT_FALLBACK_COLOR;
        const isSelected = selectedLocationId === locationData.id;

        try {
          const newIcon = createCategoryIcon(color, isSelected);
          if (newIcon) {
            marker.setIcon(newIcon);
          } else {
            console.warn(
              'Failed to create icon for location:',
              locationData.id,
            );
          }
        } catch (error) {
          console.warn('Failed to update marker icon:', error);
        }

        if (!isSelected && marker.getPopup && marker.getPopup()?.isOpen()) {
          try {
            marker.closePopup();
          } catch (error) {
            console.warn('Failed to close popup:', error);
          }
        }
      }
    });

    if (showClusters && markerClusterGroup.current) {
      try {
        markerClusterGroup.current.refreshClusters();
      } catch (error) {
        console.warn('Failed to refresh clusters:', error);
      }
    }

    if (selectedLocationId) {
      const marker = markersRef.current[selectedLocationId];
      const location = mappableLocations.find(
        (l) => l.id === selectedLocationId,
      );

      if (marker && location) {
        const targetLatLng = L.current.latLng(
          location.latitude,
          location.longitude,
        );

        try {
          if (showClusters && markerClusterGroup.current) {
            setTimeout(() => {
              if (marker && selectedLocationId === location.id) {
                try {
                  marker.openPopup();
                } catch (popupError) {
                  console.warn('Failed to open popup:', popupError);
                }
              }
            }, 200);
          } else {
            if (
              mapInstance.current &&
              mapContainer.current &&
              mapContainer.current.offsetWidth > 0
            ) {
              const currentZoom = mapInstance.current.getZoom();
              let targetZoom;

              if (currentZoom < 8) {
                targetZoom = 12;
              } else if (currentZoom < 12) {
                targetZoom = 14;
              } else {
                targetZoom = Math.max(currentZoom, 13);
              }

              mapInstance.current.flyTo(targetLatLng, targetZoom, {
                duration: 1.0,
                easeLinearity: 0.5,
              });

              setTimeout(() => {
                if (marker && selectedLocationId === location.id) {
                  try {
                    marker.openPopup();
                  } catch (popupError) {
                    console.warn(
                      'Failed to open popup after zoom:',
                      popupError,
                    );
                  }
                }
              }, 1100);
            }

            try {
              marker.openPopup();
            } catch (popupError) {
              console.warn('Failed to open popup immediately:', popupError);
            }
          }
        } catch (error) {
          console.warn('Error in selection effect:', error);
        }
      }
    } else {
      if (
        mapInstance.current &&
        mapContainer.current &&
        mapContainer.current.offsetWidth > 0
      ) {
        const currentZoom = mapInstance.current.getZoom();
        if (currentZoom > 10) {
          mapInstance.current.flyTo(mapInstance.current.getCenter(), 6, {
            duration: 0.8,
            easeLinearity: 0.5,
          });
        }
      }
    }
  }, [
    selectedLocationId,
    isMapInitialized,
    activeCategoryStyles,
    createCategoryIcon,
    showClusters,
  ]);

  useEffect(() => {
    if (!isMapInitialized || !mapInstance.current || !mapContainer.current)
      return;

    if (selectedLocationId) {
      const location = mappableLocations.find(
        (l) => l.id === selectedLocationId,
      );
      if (location) {
        const targetLatLng = L.current.latLng(
          location.latitude,
          location.longitude,
        );
        const currentZoom = mapInstance.current.getZoom();
        const targetZoom =
          currentZoom < 8
            ? 12
            : currentZoom < 12
            ? 14
            : Math.max(currentZoom, 13);

        mapInstance.current.flyTo(targetLatLng, targetZoom, {
          duration: 1.0,
          easeLinearity: 0.5,
        });
      }
    }
  }, [selectedLocationId, isMapInitialized, mappableLocations]);

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
    if (
      !isMapInitialized ||
      !mapInstance.current ||
      !mapContainer.current ||
      !triggerResize
    )
      return;

    const timeoutId = setTimeout(() => {
      try {
        if (
          mapInstance.current &&
          mapContainer.current &&
          mapContainer.current.offsetWidth > 0 &&
          mapContainer.current.offsetHeight > 0
        ) {
          mapInstance.current.invalidateSize();
        }
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
              <Globe className="h-16 w-16 text-secondary mx-auto animate-pulse" />
              <Loader2 className="absolute inset-0 h-16 w-16 text-secondary animate-spin" />
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

      <div
        ref={mapContainer}
        className="w-full h-full min-h-[400px] min-w-[300px]"
      />

      {isMapInitialized && !isMapLoading && (
        <>
          <div className="absolute top-4 left-4 z-[1040] flex items-center space-x-3">
            <div className="bg-stone-50/95 backdrop-blur-sm rounded-xl shadow-lg px-4 py-3 border border-stone-200/60">
              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-secondary-foreground" />
                  <span className="font-semibold text-stone-700">
                    {mapStats.visiblePoints}
                  </span>
                  <span className="text-stone-500 font-medium">locations</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Layers className="h-4 w-4 text-secondary-foreground" />
                  <span className="font-semibold text-stone-700">
                    {mapStats.categories}
                  </span>
                  <span className="text-stone-500 font-medium">categories</span>
                </div>
              </div>
            </div>

            {/* Tile Layer Switcher - Hidden on Mobile */}
            {!isMobile && (
              <div className="bg-stone-50/95 backdrop-blur-sm rounded-xl shadow-lg border border-stone-200/60 overflow-hidden">
                <div className="flex">
                  {Object.entries(TILE_LAYERS).map(([key, layer]) => (
                    <button
                      key={key}
                      onClick={() => switchTileLayer(key)}
                      className={`px-4 py-3 text-xs font-semibold transition-all duration-200 ${
                        currentTileLayer === key
                          ? 'bg-secondary text-secondary-foreground shadow-sm'
                          : 'text-stone-600 hover:text-stone-800 hover:bg-stone-100/60'
                      }`}
                      title={`Switch to ${layer.name}`}
                    >
                      {layer.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
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

            {/* Clustering Control - Hidden on Mobile */}
            {!isMobile && (
              <div className="bg-stone-50/95 backdrop-blur-sm rounded-xl shadow-lg border border-stone-200/60 overflow-hidden">
                <button
                  onClick={toggleClustering}
                  className={`p-3 transition-all duration-200 ${
                    showClusters
                      ? 'text-secondary-foreground bg-secondary/10'
                      : 'text-stone-600 hover:text-stone-800 hover:bg-stone-100/60'
                  }`}
                  title={
                    showClusters ? 'Disable Clustering' : 'Enable Clustering'
                  }
                >
                  <Circle className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {mappableLocations.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 z-[1040]">
              <div className="bg-stone-50/95 backdrop-blur-sm rounded-xl shadow-lg px-6 py-3 border border-stone-200/60">
                <div
                  className={`flex items-center ${
                    isMobile ? 'justify-center' : 'justify-between'
                  } text-sm`}
                >
                  <div
                    className={`flex items-center ${
                      isMobile ? 'space-x-3' : 'space-x-6'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Navigation className="h-4 w-4 text-secondary-foreground" />
                      <span className="text-stone-700 font-medium">
                        {
                          TILE_LAYERS[
                            currentTileLayer as keyof typeof TILE_LAYERS
                          ].name
                        }{' '}
                        View
                      </span>
                    </div>
                    {!isMobile && (
                      <>
                        <div className="h-4 w-px bg-stone-300/80" />
                        <div className="text-stone-600 font-medium">
                          {showClusters ? 'Clustered' : 'Individual'} markers
                        </div>
                      </>
                    )}
                  </div>
                  {!isMobile && (
                    <div className="text-stone-500 font-medium">
                      Click markers for details • Drag to explore
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {mappableLocations.length === 0 && (
            <div className="absolute inset-0 bg-stone-100/60 z-[1030] flex items-center justify-center">
              <div className="bg-stone-50/95 backdrop-blur-sm p-10 rounded-2xl shadow-lg text-center space-y-6 max-w-md mx-4 border border-stone-200/60">
                <div className="p-4 bg-secondary/10 rounded-2xl w-fit mx-auto">
                  <MapPin className="h-10 w-10 text-secondary-foreground" />
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
