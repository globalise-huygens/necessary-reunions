'use client';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { shouldDisplayCoordinates } from '@/lib/gazetteer/coordinate-utils';
import { createSlugFromName } from '@/lib/gazetteer/data';
import { GazetteerPlace } from '@/lib/gazetteer/types';
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
import { useRouter } from 'next/navigation';
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

interface GazetteerMapProps {
  places: GazetteerPlace[];
  selectedPlaceId?: string | null;
  onPlaceSelect?: (placeId: string | null) => void;
  triggerResize?: number;
  isMobile?: boolean;
}

// Category colors using project design system with accessibility-compliant contrast
// Colors derived from CSS custom properties in globals.css
const CATEGORY_COLORS: Record<string, string> = {
  // Settlements (Primary color variants - teal family)
  plaats: '#1F4741', // settlement - dark teal (primary color)
  stad: '#2D6B63', // city - medium teal
  dorp: '#0F3731', // village - darker teal

  // Fortifications (Accent color variants - brown family)
  fort: '#3D2617', // fort - dark brown (accent color)
  kasteel: '#5A3A25', // castle - medium brown

  // Water features (Chart-2 color variants - blue-green family)
  rivier: '#4A9B8E', // river - blue-green (chart-2)
  zee: '#6BB5AA', // sea - lighter blue-green
  meer: '#3A8579', // lake - darker blue-green
  baai: '#5AA69A', // bay - medium blue-green

  // Land features (Chart-1 color variants - warm orange family)
  eiland: '#D2691E', // island - warm orange (chart-1)
  eilanden: '#E67A33', // islands - lighter orange
  berg: '#B8571A', // mountain - darker orange
  gebergte: '#C66220', // mountain range - medium orange

  // Geographic features (Chart-4 color variants - yellow family)
  kaap: '#B8A055', // cape - warm yellow (chart-4)
  kust: '#C9B166', // coast - lighter yellow
  dal: '#A79048', // valley - darker yellow
  bergpas: '#D4C277', // mountain pass - lightest yellow

  // Political/Administrative (Secondary color variants - warm yellow family)
  landstreek: '#9B8045', // region - muted yellow (secondary)
  gebied: '#8A7240', // territory - darker muted yellow
  koninkryk: '#B09550', // kingdom - lighter muted yellow
  ryk: '#A68A4A', // realm - medium muted yellow

  // Default categories
  place: '#1F4741', // default place - primary color
  unknown: '#5A5A5A', // unknown - accessible gray
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

const DEFAULT_FALLBACK_COLOR = '#1F4741'; // Use primary color as fallback for better brand consistency

export default function GazetteerMap({
  places,
  selectedPlaceId,
  onPlaceSelect,
  triggerResize,
  isMobile = false,
}: GazetteerMapProps) {
  const router = useRouter();

  // Inject custom styles for better accessibility and brand consistency
  useEffect(() => {
    const styleId = 'gazetteer-map-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        /* Enhanced marker styles for accessibility */
        .gazetteer-marker {
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .gazetteer-marker:hover {
          transform: scale(1.2);
          filter: brightness(1.1) drop-shadow(0 4px 8px rgba(31, 71, 65, 0.3));
        }

        .gazetteer-marker:focus {
          outline: 3px solid hsl(45 64% 59%);
          outline-offset: 2px;
        }

        /* Leaflet popup improvements */
        .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
          border: 1px solid hsl(0 0% 89.8%) !important;
        }

        .leaflet-popup-content {
          margin: 0 !important;
          padding: 0 !important;
        }

        .leaflet-popup-tip {
          background: hsl(0 0% 100%) !important;
          border: 1px solid hsl(0 0% 89.8%) !important;
          box-shadow: none !important;
        }

        /* Cluster styling improvements */
        .marker-cluster {
          background: linear-gradient(135deg, hsl(165 22% 26%) 0%, hsl(165 22% 32%) 100%) !important;
          border: 3px solid hsl(0 0% 100%) !important;
          border-radius: 50% !important;
          box-shadow: 0 4px 12px rgba(31, 71, 65, 0.25) !important;
        }

        .marker-cluster div {
          background: transparent !important;
          color: hsl(0 0% 98%) !important;
          font-weight: 600 !important;
          font-size: 13px !important;
          text-shadow: none !important;
        }

        .marker-cluster:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(31, 71, 65, 0.35) !important;
        }

        /* Map control improvements */
        .leaflet-control-zoom a,
        .leaflet-control-layers-toggle {
          background: hsl(0 0% 100%) !important;
          color: hsl(165 22% 26%) !important;
          border: 1px solid hsl(0 0% 89.8%) !important;
          border-radius: 8px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
        }

        .leaflet-control-zoom a:hover,
        .leaflet-control-layers-toggle:hover {
          background: hsl(165 22% 26%) !important;
          color: hsl(0 0% 98%) !important;
          border-color: hsl(165 22% 26%) !important;
        }
      `;
      document.head.appendChild(style);
    }

    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);
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

  // Filter places that have geographic coordinates (not pixel coordinates)
  const mappablePlaces = useMemo(() => {
    const placesWithCoords = places.filter(
      (place) =>
        place.coordinates && shouldDisplayCoordinates(place.coordinates),
    );

    if (placesWithCoords.length > 0) {
    }
    return placesWithCoords;
  }, [places]);

  // Get unique categories for legend
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    mappablePlaces.forEach((place) => {
      const category = place.category || 'unknown';
      stats[category] = (stats[category] || 0) + 1;
    });
    return Object.entries(stats)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [mappablePlaces]);

  useEffect(() => {
    setIsMounted(true);
    const initMap = async () => {
      try {
        setIsMapLoading(true);
        if (mapInstance.current) {
          try {
            mapInstance.current.remove();
            mapInstance.current = null;
          } catch (e) {
            console.warn('Error removing previous map instance:', e);
          }
        }

        const container = mapContainer.current;

        if (
          !container ||
          container.offsetWidth === 0 ||
          container.offsetHeight === 0
        ) {
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

        // Initialize map centered on Kerala region
        const map = L.current.map(mapContainer.current, {
          center: [10.5, 76.0], // Kerala coordinates
          zoom: 7,
          zoomControl: false,
          preferCanvas: true,
          renderer: L.current.canvas(),
        });

        mapInstance.current = map;

        // Add base layer
        const currentLayer =
          TILE_LAYERS[currentTileLayer as keyof typeof TILE_LAYERS];
        L.current
          .tileLayer(currentLayer.url, {
            attribution: currentLayer.attribution,
            maxZoom: 18,
            detectRetina: true,
            updateWhenIdle: true,
          })
          .addTo(map);

        // Initialize marker cluster group
        markerClusterGroup.current = L.current.markerClusterGroup({
          chunkedLoading: true,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          maxClusterRadius: 50,
          iconCreateFunction: (cluster: any) => {
            const count = cluster.getChildCount();
            let size = 'small';
            if (count >= 10) size = 'large';
            else if (count >= 5) size = 'medium';

            return L.current.divIcon({
              html: `<div><span>${count}</span></div>`,
              className: `marker-cluster marker-cluster-${size}`,
              iconSize: L.current.point(40, 40),
            });
          },
        });

        setIsMapInitialized(true);
        setIsMapLoading(false);
      } catch (error) {
        console.error('Error initializing map:', error);
        setIsMapLoading(false);
        if (mapContainer.current) {
          mapContainer.current.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: #f5f5f5;">
              <div style="background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;">
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

        Object.values(markersRef.current).forEach((marker: any) => {
          try {
            if (mapInstance.current && mapInstance.current.hasLayer(marker)) {
              mapInstance.current.removeLayer(marker);
            }
          } catch (e) {
            console.warn('Error removing marker:', e);
          }
        });
        markersRef.current = {};

        if (mapInstance.current) {
          try {
            mapInstance.current.remove();
            mapInstance.current = null;
          } catch (e) {
            console.warn('Error removing map instance:', e);
          }
        }
      } catch (error) {
        console.warn('Error during map cleanup:', error);
      }
    };
  }, []);

  // Update markers when places change
  useEffect(() => {
    if (!isMapInitialized || !mapInstance.current || !L.current) {
      return;
    }

    try {
      // Clear existing markers
      if (markerClusterGroup.current) {
        markerClusterGroup.current.clearLayers();
        if (mapInstance.current?.hasLayer(markerClusterGroup.current)) {
          mapInstance.current.removeLayer(markerClusterGroup.current);
        }
      }
      Object.values(markersRef.current).forEach((marker: any) => {
        try {
          if (mapInstance.current?.hasLayer(marker)) {
            mapInstance.current.removeLayer(marker);
          }
        } catch (e) {
          console.warn('Error removing marker:', e);
        }
      });
      markersRef.current = {};

      // Create a fresh cluster group for this update
      markerClusterGroup.current = L.current.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
      });

      const leafletMarkers: any[] = [];

      mappablePlaces.forEach((place, index) => {
        if (!place.coordinates) {
          return;
        }

        // Convert coordinates: x = longitude, y = latitude
        const lat = place.coordinates.y;
        const lng = place.coordinates.x;

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          console.warn(
            `Invalid coordinates for place ${place.name}: ${lat}, ${lng}`,
          );
          return;
        }

        const category = place.category || 'unknown';
        const color = CATEGORY_COLORS[category] || DEFAULT_FALLBACK_COLOR;

        // Create custom marker with improved accessibility and visual hierarchy
        const marker = L.current.circleMarker([lat, lng], {
          radius: 10, // Slightly larger for better visibility
          fillColor: color,
          color: '#FFFFFF', // White border for high contrast
          weight: 3, // Thicker border for better definition
          opacity: 1,
          fillOpacity: 0.9, // Higher opacity for better visibility
          // Add hover and focus states for accessibility
          className: 'gazetteer-marker',
        });

        // Create popup content with project design system styling
        const popupContent = `
          <div style="
            min-width: 220px;
            font-family: Inter, system-ui, -apple-system, sans-serif;
            background: hsl(0 0% 100%);
            border-radius: 0.5rem;
            border: 1px solid hsl(0 0% 89.8%);
            overflow: hidden;
          ">
            <div style="
              padding: 16px;
              background: hsl(165 22% 26%);
              color: hsl(0 0% 98%);
              margin: -1px -1px 12px -1px;
            ">
              <strong style="
                font-size: 15px;
                font-weight: 600;
                display: block;
                line-height: 1.4;
              ">${place.name}</strong>
            </div>
            <div style="padding: 0 16px 16px 16px;">
            ${
              place.alternativeNames && place.alternativeNames.length > 0
                ? `
              <div style="
                margin-bottom: 12px;
                font-size: 12px;
                color: hsl(0 0% 45.1%);
                line-height: 1.4;
              ">
                <span style="font-weight: 500; color: hsl(165 22% 26%);">Also known as:</span><br>
                ${place.alternativeNames.slice(0, 2).join(', ')}
                ${
                  place.alternativeNames.length > 2
                    ? ` <span style="color: hsl(0 0% 45.1%);">(+${
                        place.alternativeNames.length - 2
                      } more)</span>`
                    : ''
                }
              </div>
            `
                : ''
            }
            <div style="margin-bottom: 10px;">
              <span style="
                color: hsl(165 22% 26%);
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                font-weight: 600;
              ">Category:</span>
              <span style="
                color: hsl(0 0% 45.1%);
                margin-left: 6px;
                font-size: 13px;
                padding: 2px 8px;
                background: hsl(180 12% 95%);
                border-radius: 12px;
                font-weight: 500;
              ">${category}</span>
            </div>
            ${
              place.modernName
                ? `
              <div style="margin-bottom: 10px;">
                <span style="
                  color: hsl(165 22% 26%);
                  font-size: 11px;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                  font-weight: 600;
                ">Modern Name:</span>
                <span style="
                  color: hsl(0 0% 26%);
                  margin-left: 6px;
                  font-size: 13px;
                  font-weight: 500;
                ">${place.modernName}</span>
              </div>
            `
                : ''
            }
            <div style="margin-bottom: 12px;">
              <span style="
                color: hsl(165 22% 26%);
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                font-weight: 600;
              ">Coordinates:</span>
              <span style="
                color: hsl(0 0% 26%);
                font-family: 'JetBrains Mono', 'Source Code Pro', monospace;
                font-size: 12px;
                margin-left: 6px;
                background: hsl(180 12% 95%);
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 500;
              ">${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
            </div>
            ${
              place.mapInfo
                ? `
              <div style="margin-bottom: 12px;">
                <span style="
                  color: hsl(165 22% 26%);
                  font-size: 11px;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                  font-weight: 600;
                ">Map:</span>
                <span style="
                  color: hsl(0 0% 26%);
                  margin-left: 6px;
                  font-size: 13px;
                  font-weight: 500;
                ">${place.mapInfo.title} ${
                    place.mapInfo.date ? `(${place.mapInfo.date})` : ''
                  }</span>
              </div>
            `
                : ''
            }
            <div style="
              margin-top: 16px;
              padding-top: 16px;
              border-top: 1px solid hsl(0 0% 89.8%);
            ">
              <button onclick="window.location.href='/gazetteer/${createSlugFromName(
                place.name,
              )}'"
                      style="
                        background: linear-gradient(135deg, hsl(165 22% 26%) 0%, hsl(165 22% 32%) 100%);
                        color: hsl(0 0% 98%);
                        padding: 10px 16px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 600;
                        width: 100%;
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 4px hsl(0 0% 0% / 0.1);
                      "
                      onmouseover="this.style.background='linear-gradient(135deg, hsl(165 22% 22%) 0%, hsl(165 22% 28%) 100%)'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px hsl(0 0% 0% / 0.15)'"
                      onmouseout="this.style.background='linear-gradient(135deg, hsl(165 22% 26%) 0%, hsl(165 22% 32%) 100%)'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px hsl(0 0% 0% / 0.1)'"
                      >
                View Details →
              </button>
            </div>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, {
          minWidth: 200,
          className: 'gazetteer-popup',
        });

        marker.on('click', (e: any) => {
          e.originalEvent?.stopPropagation();
          if (onPlaceSelect) {
            onPlaceSelect(place.id);
          }
        });

        markersRef.current[place.id] = marker;
        leafletMarkers.push(marker);
      });

      if (leafletMarkers.length > 0) {
        if (showClusters) {
          markerClusterGroup.current.addLayers(leafletMarkers);

          mapInstance.current.addLayer(markerClusterGroup.current);
        } else {
          leafletMarkers.forEach((marker, index) => {
            try {
              mapInstance.current?.addLayer(marker);
            } catch (error) {
              console.warn('Failed to add individual marker:', error);
            }
          });
        }

        // Fit map to show all markers
        try {
          const group = new L.current.FeatureGroup(leafletMarkers);
          const bounds = group.getBounds();

          if (
            bounds.isValid() &&
            mapContainer.current &&
            mapContainer.current.offsetWidth > 0
          ) {
            mapInstance.current.fitBounds(bounds, {
              padding: [20, 20],
              maxZoom: 10,
            });
          } else {
          }
        } catch (error) {
          console.warn('Error fitting bounds:', error);
        }
      } else {
      }

      // Update stats
      setMapStats({
        totalPoints: places.length,
        visiblePoints: mappablePlaces.length,
        categories: categoryStats.length,
      });
    } catch (error) {
      console.error('GazetteerMap: Error in markers update effect:', error);
    }
  }, [mappablePlaces, isMapInitialized, showClusters]);

  // Handle selected place
  useEffect(() => {
    if (!selectedPlaceId || !markersRef.current[selectedPlaceId]) return;

    const marker = markersRef.current[selectedPlaceId];
    const place = mappablePlaces.find((p) => p.id === selectedPlaceId);

    if (place && place.coordinates) {
      const lat = place.coordinates.y;
      const lng = place.coordinates.x;

      mapInstance.current?.setView([lat, lng], 12);

      setTimeout(() => {
        if (marker) {
          try {
            marker.openPopup();
          } catch (error) {
            console.warn('Failed to open popup:', error);
          }
        }
      }, 500);
    }
  }, [selectedPlaceId, mappablePlaces]);

  // Add legend control
  useEffect(() => {
    if (!isMapInitialized || !mapInstance.current || !L.current) return;

    if (legendControl.current) {
      mapInstance.current.removeControl(legendControl.current);
      legendControl.current = null;
    }

    const sortedCategories = categoryStats;

    if (sortedCategories.length > 0) {
      const control = L.current.control({ position: 'bottomright' });

      control.onAdd = () => {
        const div = L.current.DomUtil.create('div', 'gazetteer-legend');
        div.style.background = 'rgba(255, 255, 255, 0.95)';
        div.style.backdropFilter = 'blur(4px)';
        div.style.padding = '12px';
        div.style.borderRadius = '8px';
        div.style.border = '1px solid rgba(231, 229, 228, 0.6)';
        div.style.boxShadow = '0 4px 12px rgba(101, 79, 60, 0.15)';
        div.style.maxWidth = '200px';
        div.style.fontFamily = "'Inter', system-ui, sans-serif";

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
          sortedCategories.forEach((item) => {
            const color =
              CATEGORY_COLORS[item.category] || DEFAULT_FALLBACK_COLOR;
            legendHtml += `
              <div style="display: flex; align-items: center; margin-bottom: 4px; font-size: 12px;">
                <div style="width: 12px; height: 12px; background-color: ${color}; border-radius: 50%; margin-right: 8px; border: 1px solid rgba(255,255,255,0.8);"></div>
                <span style="color: #57534e; font-weight: 500;">${item.category}</span>
                <span style="color: #78716c; margin-left: auto; font-size: 11px;">${item.count}</span>
              </div>
            `;
          });
          content.innerHTML = legendHtml;
        }

        return div;
      };

      legendControl.current = control;
      mapInstance.current.addControl(control);
    }
  }, [isMapInitialized, categoryStats, isLegendOpen]);

  return (
    <div className="relative w-full h-full bg-gray-50">
      {isMapLoading && (
        <div className="absolute inset-0 bg-gray-50 flex items-center justify-center z-50">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">
              Loading historical map...
            </p>
          </div>
        </div>
      )}

      <div
        ref={mapContainer}
        className="w-full h-full"
        style={{
          backgroundColor: '#f0f0f0',
          minHeight: '400px',
          height: '100%',
          width: '100%',
          position: 'relative',
          zIndex: 1,
        }}
        onLoad={() => console.log('GazetteerMap: Map container onLoad')}
      />

      {isMounted && mappablePlaces.length === 0 && !isMapLoading && (
        <div className="absolute inset-0 bg-muted/20 bg-opacity-75 z-10 flex items-center justify-center">
          <div className="bg-card p-6 rounded-lg shadow-lg text-center space-y-3">
            <Globe className="h-8 w-8 text-primary mx-auto" />
            <div>
              <h3 className="text-lg font-medium text-card-foreground">
                No mappable places
              </h3>
              <p className="text-sm text-muted-foreground">
                No places in the current selection have geographic coordinates.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Map Stats */}
      {isMounted && mappablePlaces.length > 0 && (
        <div className="absolute top-4 left-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-xs text-gray-600">
          <div className="space-y-1">
            <div>Total places: {mapStats.totalPoints}</div>
            <div>On map: {mapStats.visiblePoints}</div>
            <div>Categories: {mapStats.categories}</div>
          </div>
        </div>
      )}
    </div>
  );
}
