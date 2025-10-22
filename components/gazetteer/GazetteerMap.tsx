'use client';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import '../../styles/gazetteer-map.css';
import { Globe, Loader2 } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { shouldDisplayCoordinates } from '../../lib/gazetteer/coordinate-utils';
import { createSlugFromName } from '../../lib/gazetteer/data';
import type { GazetteerPlace } from '../../lib/gazetteer/types';

declare global {
  interface Window {
    L: any;
  }
}

interface GazetteerMapProps {
  places: GazetteerPlace[];
  selectedPlaceId?: string | null;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const CATEGORY_COLORS: Record<string, string> = {
  // Settlements (Primary color variants - teal family)
  plaats: '#1F4741',
  stad: '#2D6B63',
  dorp: '#0F3731',

  // Fortifications (Accent color variants - brown family)
  fort: '#3D2617',
  kasteel: '#5A3A25',

  // Water features (Chart-2 color variants - blue-green family)
  rivier: '#4A9B8E',
  zee: '#6BB5AA',
  meer: '#3A8579',
  baai: '#5AA69A',

  // Land features (Chart-1 color variants - warm orange family)
  eiland: '#D2691E',
  eilanden: '#E67A33',
  berg: '#B8571A',
  gebergte: '#C66220',

  // Geographic features (Chart-4 color variants - yellow family)
  kaap: '#B8A055',
  kust: '#C9B166',
  dal: '#A79048',
  bergpas: '#D4C277',

  // Political/Administrative (Secondary color variants - warm yellow family)
  landstreek: '#9B8045',
  gebied: '#8A7240',
  koninkryk: '#B09550',
  ryk: '#A68A4A',

  // Default categories
  place: '#1F4741',
  unknown: '#5A5A5A',
};

// eslint-disable-next-line @typescript-eslint/naming-convention
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

const DEFAULT_FALLBACK_COLOR = '#1F4741';

export default function GazetteerMap({
  places,
  selectedPlaceId,
}: GazetteerMapProps) {
  // Intentional DOM manipulation for Leaflet CSS - no React alternative available
  useEffect(() => {
    const styleId = 'gazetteer-map-styles';
    // eslint-disable-next-line no-restricted-syntax
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

        /* Tooltip styling */
        .gazetteer-marker-tooltip {
          background: hsl(0 0% 100%) !important;
          border: 1px solid hsl(0 0% 89.8%) !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
          padding: 6px 10px !important;
        }

        .gazetteer-marker-tooltip::before {
          border-top-color: hsl(0 0% 100%) !important;
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
          font-size: 14px !important;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2) !important;
          line-height: 40px !important;
          text-align: center !important;
          width: 40px !important;
          height: 40px !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        .marker-cluster div span {
          display: inline-block !important;
          vertical-align: middle !important;
          line-height: normal !important;
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
      // eslint-disable-next-line no-restricted-syntax
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
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const L = useRef<any>(null);

  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const showClusters = true;
  const currentTileLayer = 'osm';
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [mapStats, setMapStats] = useState({
    totalPoints: 0,
    visiblePoints: 0,
    categories: 0,
  });

  const mappablePlaces = useMemo(() => {
    const placesWithCoords = places.filter(
      (place) =>
        place.coordinates && shouldDisplayCoordinates(place.coordinates),
    );

    if (placesWithCoords.length > 0) {
    }
    return placesWithCoords;
  }, [places]);

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
    let isMountedLocal = true;
    setIsMounted(true);

    const containerRef = mapContainer.current;

    const initMap = async () => {
      if (!isMountedLocal) return;

      try {
        setIsMapLoading(true);

        if (mapInstance.current) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            mapInstance.current.off();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            mapInstance.current.remove();
            mapInstance.current = null;
          } catch (e) {
            console.warn('Error removing existing map:', e);
          }
        }

        const container = mapContainer.current;

        // Validate container before proceeding
        if (!container || !container.isConnected) {
          setTimeout(() => {
            initMap().catch((err) =>
              console.warn('Map initialization retry failed:', err),
            );
          }, 100);
          return;
        }

        if (container.offsetWidth === 0 || container.offsetHeight === 0) {
          setTimeout(() => {
            initMap().catch((err) =>
              console.warn('Map initialization retry failed:', err),
            );
          }, 100);
          return;
        }

        const leaflet = await import('leaflet');
        L.current = leaflet.default;

        await import('leaflet.markercluster');

        if (!mapContainer.current?.isConnected) {
          return;
        }

        const containerElement = mapContainer.current;
        containerElement.innerHTML = '';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        delete (containerElement as any)._leaflet_id;

        if (containerElement.offsetWidth === 0) {
          setTimeout(() => {
            initMap().catch((err) =>
              console.warn('Map initialization retry failed:', err),
            );
          }, 100);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const map = L.current.map(containerElement, {
          center: [10.5, 76.0],
          zoom: 7,
          zoomControl: false,
          preferCanvas: true,
          closePopupOnClick: false,
          trackResize: true,
          dragging: true,
          touchZoom: true,
          doubleClickZoom: true,
          scrollWheelZoom: true,
          boxZoom: true,
          keyboard: true,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          renderer: L.current.canvas(),
        });

        mapInstance.current = map;

        const currentLayer =
          TILE_LAYERS[currentTileLayer as keyof typeof TILE_LAYERS];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const tileLayer = L.current.tileLayer(currentLayer.url, {
          attribution: currentLayer.attribution,
          maxZoom: 18,
          detectRetina: true,
          updateWhenIdle: true,
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        tileLayer.addTo(map);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        markerClusterGroup.current = L.current.markerClusterGroup({
          chunkedLoading: true,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          maxClusterRadius: 50,
          iconCreateFunction: (cluster: any) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const count = cluster.getChildCount() as number;
            let size = 'small';
            if (count >= 10) size = 'large';
            else if (count >= 5) size = 'medium';

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
            return L.current.divIcon({
              html: `<div><span>${count}</span></div>`,
              className: `marker-cluster marker-cluster-${size}`,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
            <div class="gazetteer-error-container">
              <div class="gazetteer-error-box">
                <p class="gazetteer-error-text">Unable to load the interactive map component.</p>
                <button onclick="window.location.reload()" class="gazetteer-error-button">
                  Reload Page
                </button>
              </div>
            </div>
          `;
        }
      }
    };

    initMap().catch((err) => console.error('Failed to initialize map:', err));

    return () => {
      isMountedLocal = false;

      try {
        const currentMap = mapInstance.current;
        mapInstance.current = null;

        if (
          containerRef &&
          containerRef.parentNode &&
          containerRef.isConnected
        ) {
          try {
            const placeholder = document.createComment('leaflet-cleanup');
            containerRef.parentNode.replaceChild(placeholder, containerRef);

            setTimeout(() => {
              if (placeholder.parentNode) {
                placeholder.parentNode.removeChild(placeholder);
              }
            }, 100);
          } catch (e) {
            console.warn('Error removing container from DOM:', e);
          }
        }

        if (currentMap) {
          try {
            // Disable all interactions first
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (currentMap.dragging) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              currentMap.dragging.disable();
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (currentMap.touchZoom) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              currentMap.touchZoom.disable();
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (currentMap.doubleClickZoom) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              currentMap.doubleClickZoom.disable();
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (currentMap.scrollWheelZoom) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              currentMap.scrollWheelZoom.disable();
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (currentMap.boxZoom) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              currentMap.boxZoom.disable();
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (currentMap.keyboard) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              currentMap.keyboard.disable();
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            currentMap.off();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            currentMap.stop();
          } catch (e) {
            console.warn('Error disabling map interactions:', e);
          }
        }

        if (legendControl.current && currentMap) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            currentMap.removeControl(legendControl.current);
          } catch (e) {
            console.warn('Error removing legend control:', e);
          }
          legendControl.current = null;
        }

        if (markerClusterGroup.current) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            if (currentMap?.hasLayer(markerClusterGroup.current)) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              currentMap.removeLayer(markerClusterGroup.current);
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            markerClusterGroup.current.clearLayers();
          } catch (e) {
            console.warn('Error removing cluster group:', e);
          }
          markerClusterGroup.current = null;
        }

        Object.values(markersRef.current).forEach((marker: any) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            if (marker && currentMap?.hasLayer(marker)) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              currentMap.removeLayer(marker);
            }
          } catch (e) {
            console.warn('Error removing marker:', e);
          }
        });
        markersRef.current = {};

        if (currentMap) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            currentMap.remove();
          } catch (e) {
            console.warn('Error removing map instance:', e);
          }
        }

        if (containerRef) {
          try {
            containerRef.innerHTML = '';
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            delete (containerRef as any)._leaflet_id;
          } catch (e) {
            console.warn('Error clearing container:', e);
          }
        }
      } catch (error) {
        console.warn('Error in map cleanup:', error);
      }
    };
  }, []);

  useEffect(() => {
    if (!isMapInitialized || !mapInstance.current || !L.current) {
      return;
    }

    try {
      if (markerClusterGroup.current) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        markerClusterGroup.current.clearLayers();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        if (mapInstance.current?.hasLayer(markerClusterGroup.current)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          mapInstance.current.removeLayer(markerClusterGroup.current);
        }
      }
      Object.values(markersRef.current).forEach((marker: any) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          if (mapInstance.current?.hasLayer(marker)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            mapInstance.current.removeLayer(marker);
          }
        } catch {}
      });
      markersRef.current = {};

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      markerClusterGroup.current = L.current.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
      });

      const leafletMarkers: any[] = [];

      // Batch process markers for better performance
      const validPlaces = mappablePlaces.filter((place) => {
        if (!place.coordinates) return false;
        const lat = place.coordinates.y;
        const lng = place.coordinates.x;
        return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      });

      validPlaces.forEach((place) => {
        const lat = place.coordinates!.y;
        const lng = place.coordinates!.x;

        const category = place.category || 'unknown';
        const color = CATEGORY_COLORS[category] || DEFAULT_FALLBACK_COLOR;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const marker = L.current.circleMarker([lat, lng], {
          radius: 8,
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8,
          fillColor: color,
          color: '#fff',
          pane: 'markerPane',
        });

        // Add hover tooltip
        const tooltipContent = `
          <div>
            ${place.name}
            ${place.category ? `<span class="gazetteer-tooltip-category">· ${place.category}</span>` : ''}
          </div>
        `;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        marker.bindTooltip(tooltipContent, {
          permanent: false,
          direction: 'top',
          offset: [0, -8],
          className: 'gazetteer-marker-tooltip',
        });

        const popupContent = `
          <div class="gazetteer-popup">
            <div class="gazetteer-popup-header">
              <strong class="gazetteer-popup-title">${place.name}</strong>
            </div>
            <div class="gazetteer-popup-body">
            ${
              place.alternativeNames && place.alternativeNames.length > 0
                ? `
              <div class="gazetteer-alt-names">
                <span class="gazetteer-alt-names-label">Also known as:</span><br>
                ${place.alternativeNames.slice(0, 2).join(', ')}
                ${
                  place.alternativeNames.length > 2
                    ? ` <span class="gazetteer-alt-names-more">(+${
                        place.alternativeNames.length - 2
                      } more)</span>`
                    : ''
                }
              </div>
            `
                : ''
            }
            <div class="gazetteer-field">
              <span class="gazetteer-label">Category:</span>
              <span class="gazetteer-value-muted">${category}</span>
            </div>
            ${
              place.modernName
                ? `
              <div class="gazetteer-field">
                <span class="gazetteer-label">Modern Name:</span>
                <span class="gazetteer-value">${place.modernName}</span>
              </div>
            `
                : ''
            }
            <div class="gazetteer-field-large">
              <span class="gazetteer-label">Coordinates:</span>
              <span class="gazetteer-value-code">${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
            </div>
            ${
              place.mapInfo
                ? `
              <div class="gazetteer-field-large">
                <span class="gazetteer-label">Map:</span>
                <span class="gazetteer-value">${place.mapInfo.title} ${
                  place.mapInfo.date ? `(${place.mapInfo.date})` : ''
                }</span>
              </div>
            `
                : ''
            }
            <div class="gazetteer-popup-footer">
              <button onclick="window.location.href='/gazetteer/${createSlugFromName(
                place.name,
              )}'"
                      class="gazetteer-popup-button">
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

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        marker.bindPopup(popupContent, {
          minWidth: 200,
          className: 'gazetteer-popup',
          closeButton: true,
          autoClose: true,
        });

        // Click to open popup (not navigate)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        marker.on('click', (e: any) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            e.originalEvent?.stopPropagation();
            // Open popup on click, selection handled through popup button
            if (mapContainer.current?.isConnected) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              marker.openPopup();
            }
          } catch (error) {
            console.warn('Error handling marker click:', error);
          }
        });

        markersRef.current[place.id] = marker;
        leafletMarkers.push(marker);
      });

      if (leafletMarkers.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        markerClusterGroup.current.addLayers(leafletMarkers);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        mapInstance.current.addLayer(markerClusterGroup.current);

        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          const group = new L.current.FeatureGroup(leafletMarkers);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          const bounds = group.getBounds();

          if (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            bounds.isValid() &&
            mapContainer.current &&
            mapContainer.current.offsetWidth > 0
          ) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            mapInstance.current.fitBounds(bounds, {
              padding: [20, 20],
              maxZoom: 10,
            });
          }
        } catch {
          // Silently ignore bounds fitting errors
        }
      }

      setMapStats({
        totalPoints: places.length,
        visiblePoints: mappablePlaces.length,
        categories: categoryStats.length,
      });
    } catch (error) {
      console.error('GazetteerMap: Error in markers update effect:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappablePlaces, isMapInitialized, showClusters]);

  useEffect(() => {
    if (!selectedPlaceId || !markersRef.current[selectedPlaceId]) return;

    const marker = markersRef.current[selectedPlaceId];
    const place = mappablePlaces.find((p) => p.id === selectedPlaceId);

    if (place && place.coordinates) {
      const lat = place.coordinates.y;
      const lng = place.coordinates.x;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mapInstance.current?.setView([lat, lng], 12);

      setTimeout(() => {
        if (marker) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            marker.openPopup();
          } catch {
            // Silently ignore popup opening errors
          }
        }
      }, 500);
    }
  }, [selectedPlaceId, mappablePlaces]);

  useEffect(() => {
    if (!isMapInitialized || !mapInstance.current || !L.current) return;

    if (legendControl.current) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mapInstance.current.removeControl(legendControl.current);
      legendControl.current = null;
    }

    const sortedCategories = categoryStats;

    if (sortedCategories.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const control = L.current.control({ position: 'bottomright' });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      control.onAdd = () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const div = L.current.DomUtil.create('div', 'gazetteer-legend-control');

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const header = L.current.DomUtil.create(
          'div',
          'gazetteer-legend-header',
          div,
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        header.style.cursor = 'pointer';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        header.style.marginBottom = isLegendOpen ? '8px' : '0';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        header.innerHTML = `<span>Categories</span><span class="gazetteer-legend-count">${
          isLegendOpen ? '▼' : '▶'
        }</span>`;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const content = L.current.DomUtil.create(
          'div',
          'gazetteer-legend-body',
          div,
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        content.style.display = isLegendOpen ? 'block' : 'none';

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        L.current.DomEvent.disableClickPropagation(div);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        L.current.DomEvent.disableScrollPropagation(div);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        header.onclick = (e: any) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          e.stopPropagation();
          setIsLegendOpen(!isLegendOpen);
        };

        if (isLegendOpen) {
          let legendHtml = '';
          sortedCategories.forEach((item) => {
            const color =
              CATEGORY_COLORS[item.category] || DEFAULT_FALLBACK_COLOR;
            legendHtml += `
              <div class="gazetteer-legend-item">
                <div class="gazetteer-legend-marker" style="background-color: ${color};"></div>
                <span class="gazetteer-legend-label">${item.category}</span>
                <span class="gazetteer-legend-count-value">${item.count}</span>
              </div>
            `;
          });
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          content.innerHTML = legendHtml;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return div;
      };

      legendControl.current = control;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
        onLoad={() => {}}
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
