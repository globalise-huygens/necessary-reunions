'use client';

import 'leaflet/dist/leaflet.css';
import { getCanvasContentType, isImageCanvas } from '@/lib/iiif-helpers';
import { WarpedMapLayer } from '@allmaps/leaflet';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapControls } from './MapControls';

interface AllmapsMapProps {
  manifest: any;
  currentCanvas: number;
}

export default function AllmapsMap({
  manifest,
  currentCanvas,
}: AllmapsMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const warpedRef = useRef<WarpedMapLayer | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [opacity, setOpacity] = useState(0.7);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [loadedMapsCount, setLoadedMapsCount] = useState(0);

  useEffect(() => {
    const containerElement = container.current;
    if (!containerElement || !mapRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        setTimeout(() => {
          mapRef.current?.invalidateSize();
        }, 10);
      }
    });

    resizeObserver.observe(containerElement);

    const handleWindowResize = () => {
      if (mapRef.current) {
        setTimeout(() => {
          mapRef.current?.invalidateSize();
        }, 10);
      }
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [initialized]);

  useEffect(() => {
    if (!container.current || mapRef.current) return;

    const map = L.map(container.current, { center: [9.9, 76.4], zoom: 8 });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    polygonRef.current = L.polygon([], {
      weight: 2,
      color: 'hsl(22, 32%, 26%)',
      fillColor: 'hsl(22, 32%, 26%)',
      fillOpacity: 0.1,
      opacity: 0.8,
    });

    map.createPane('warpedPane');
    const warpedPane = map.getPane('warpedPane')!;
    warpedPane.style.zIndex = '1001';
    warpedPane.style.pointerEvents = 'auto';
    warpedPane.style.mixBlendMode = 'normal';

    map.createPane('markersPane');
    const markersPane = map.getPane('markersPane')!;
    markersPane.style.zIndex = '1002';

    const canvas = map.getContainer().querySelector('canvas');
    if (canvas) {
      const gl =
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl && 'getError' in gl) {
        const webgl = gl as WebGLRenderingContext;
        const originalGetError = webgl.getError;
        webgl.getError = function () {
          const error = originalGetError.call(this);
          if (error !== webgl.NO_ERROR && error !== webgl.INVALID_OPERATION) {
            console.warn('WebGL Error:', error);
          }
          return error;
        };
      }
    }

    const warped = new WarpedMapLayer(null, { pane: 'warpedPane' });
    warpedRef.current = warped.addTo(map);

    warped.on('mapsloaded', () => setIsLoadingMaps(false));
    warped.on('maploadstart', () => setIsLoadingMaps(true));
    warped.on('maploadend', () => setLoadedMapsCount((prev) => prev + 1));

    const pane = map.getPane('warpedPane');
    if (pane) pane.style.opacity = opacity.toString();

    setInitialized(true);

    // Ensure proper sizing after initialization
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      if (warpedRef.current) {
        try {
          warpedRef.current.clear();
          warpedRef.current.remove();
        } catch (e) {
          console.warn('Error during warped layer cleanup:', e);
        }
      }
      if (markersRef.current) {
        markersRef.current.clearLayers();
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!initialized || !mapRef.current || !warpedRef.current) return;

    const canvas = manifest.items[currentCanvas];
    if (!canvas || !isImageCanvas(canvas)) {
      const markers = markersRef.current!;
      const outline = polygonRef.current!;
      markers.clearLayers();
      outline.setLatLngs([]);
      setIsLoadingMaps(false);
      setLoadedMapsCount(0);
      return;
    }

    setTimeout(() => {
      const map = mapRef.current!;
      const markers = markersRef.current!;
      const outline = polygonRef.current!;
      const warped = warpedRef.current!;

      markers.clearLayers();
      outline.setLatLngs([]);
      setIsLoadingMaps(false);
      setLoadedMapsCount(0);

      try {
        warped.clear();
      } catch (e) {
        console.warn('Could not clear existing maps:', e);
      }

      const canvas = manifest.items[currentCanvas];

      if (canvas.navPlace?.features?.[0]?.geometry?.coordinates) {
        const ring = canvas.navPlace.features[0].geometry.coordinates[0];
        const latlngs = ring.map((c: [number, number]) => [c[1], c[0]]);
        outline.setLatLngs(latlngs as any);
      }

      if (!canvas.annotations || canvas.annotations.length === 0) {
        return;
      }

      const validAnnotations = (canvas.annotations || []).filter(
        (annoRef: any) => {
          if (!annoRef?.id || typeof annoRef.id !== 'string') {
            return false;
          }

          try {
            new URL(annoRef.id);
          } catch (urlError) {
            return false;
          }

          if (
            annoRef.id.includes('/annotations/local') ||
            annoRef.id.includes('/local') ||
            annoRef.id.endsWith('/local')
          ) {
            return false;
          }

          return true;
        },
      );

      validAnnotations.forEach((annoRef: any) => {
        fetch(annoRef.id)
          .then((r) => {
            if (!r.ok) {
              throw new Error(`HTTP ${r.status}: ${r.statusText}`);
            }
            return r.json();
          })
          .then((page: any) => {
            const georefAnnotations =
              page.items?.filter(
                (a: any) => a.motivation === 'georeferencing',
              ) || [];

            if (georefAnnotations.length === 0) return;

            georefAnnotations.forEach((annotation: any) => {
              if (!annotation || !warped) return;

              const addControlPointMarkers = () => {
                if (annotation.body?.features) {
                  annotation.body.features.forEach(
                    (feature: any, index: number) => {
                      if (feature.geometry?.coordinates) {
                        const [lon, lat] = feature.geometry.coordinates;
                        const marker = L.marker([lat, lon], {
                          icon: lucideMarkerIcon(),
                          pane: 'markersPane',
                        });

                        if (feature.properties?.resourceCoords) {
                          const [x, y] = feature.properties.resourceCoords;
                          marker.bindPopup(
                            `Control Point ${
                              index + 1
                            }<br>Image: ${x}, ${y}<br>Geo: ${lat.toFixed(
                              6,
                            )}, ${lon.toFixed(6)}`,
                          );
                        }

                        marker.addTo(markers);
                      }
                    },
                  );
                }
              };

              const createImageOverlayFromUrl = (finalImageUrl: string) => {
                if (
                  finalImageUrl &&
                  annotation.body?.features &&
                  annotation.body.features.length >= 2
                ) {
                  try {
                    const controlPoints = annotation.body.features.map(
                      (feature: any) => ({
                        image: feature.properties.resourceCoords,
                        geo: feature.geometry.coordinates,
                      }),
                    );

                    const geoPoints = controlPoints.map((cp: any) => cp.geo);
                    const lons = geoPoints.map((p: any) => p[0]);
                    const lats = geoPoints.map((p: any) => p[1]);

                    const bounds = L.latLngBounds(
                      [Math.min(...lats), Math.min(...lons)],
                      [Math.max(...lats), Math.max(...lons)],
                    );

                    const imageOverlay = L.imageOverlay(finalImageUrl, bounds, {
                      opacity: opacity,
                      interactive: false,
                      crossOrigin: true,
                      pane: 'warpedPane',
                    });

                    imageOverlay.addTo(map);
                    setLoadedMapsCount((prev) => prev + 1);
                    addControlPointMarkers();

                    setTimeout(() => {
                      map.fitBounds(bounds, { padding: [20, 20] });
                    }, 100);
                  } catch (customError) {
                    console.error('Custom overlay failed:', customError);
                    addControlPointMarkers();
                  }
                } else {
                  addControlPointMarkers();
                }
              };

              const fallbackToCustomOverlay = () => {
                let imageUrl = annotation.target?.source?.id;

                if (imageUrl && !imageUrl.includes('IIIF') && annotation.id) {
                  fetch(annotation.id)
                    .then((response) => response.json())
                    .then((allmapsData) => {
                      if (allmapsData.target?.source?.id) {
                        let correctImageUrl = allmapsData.target.source.id;
                        if (
                          correctImageUrl.includes('IIIF') &&
                          !correctImageUrl.includes('/full/')
                        ) {
                          correctImageUrl =
                            correctImageUrl + '/full/max/0/default.jpg';
                        }
                        createImageOverlayFromUrl(correctImageUrl);
                      } else {
                        addControlPointMarkers();
                      }
                    })
                    .catch(() => {
                      addControlPointMarkers();
                    });
                } else {
                  if (
                    imageUrl &&
                    imageUrl.includes('IIIF') &&
                    !imageUrl.includes('/full/')
                  ) {
                    imageUrl = imageUrl + '/full/max/0/default.jpg';
                  }
                  createImageOverlayFromUrl(imageUrl || '');
                }
              };

              try {
                if (
                  annotation.id &&
                  annotation.id.startsWith('https://annotations.allmaps.org/')
                ) {
                  warped
                    .addGeoreferenceAnnotationByUrl(annotation.id)
                    .then(() => {
                      const warpedPane = map.getPane('warpedPane');
                      if (warpedPane) {
                        warpedPane.style.opacity = opacity.toString();
                        warpedPane.style.display = 'block';
                        warpedPane.style.visibility = 'visible';
                      }

                      setLoadedMapsCount((prev) => prev + 1);
                      addControlPointMarkers();

                      setTimeout(() => {
                        try {
                          const bounds = warped.getBounds();
                          if (bounds && bounds.length >= 2) {
                            const leafletBounds = L.latLngBounds(
                              [bounds[0][0], bounds[0][1]],
                              [bounds[1][0], bounds[1][1]],
                            );
                            map.fitBounds(leafletBounds, { padding: [20, 20] });
                          }

                          const canvas = map
                            .getContainer()
                            .querySelector('canvas');
                          if (canvas) {
                            canvas.addEventListener('webglcontextlost', (e) => {
                              e.preventDefault();
                            });
                            canvas.addEventListener(
                              'webglcontextrestored',
                              () => {
                                map.invalidateSize();
                              },
                            );
                          }
                        } catch (boundsError) {
                          console.warn('Could not fit bounds:', boundsError);
                        }
                      }, 2000);
                    })
                    .catch(() => {
                      fallbackToCustomOverlay();
                    });
                  return;
                }
              } catch (allmapsError: any) {
                console.warn('Allmaps library failed:', allmapsError);
              }

              fallbackToCustomOverlay();
            });
          })
          .catch((error) => {});
      });
    }, 100);
  }, [initialized, manifest, currentCanvas, opacity]);

  useEffect(() => {
    if (!mapRef.current) return;
    const pane = mapRef.current.getPane('warpedPane');
    if (pane) pane.style.opacity = opacity.toString();
  }, [opacity]);

  const lucideMarkerIcon = () => {
    const svg = renderToStaticMarkup(
      <MapPin
        strokeWidth={2}
        width={24}
        height={24}
        className="text-primary fill-secondary/50"
      />,
    );
    return L.divIcon({
      html: `<div class="marker-wrapper">${svg}</div>`,
      className: 'gcp-marker',
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });
  };

  return (
    <div className="relative w-full h-full pb-14 sm:pb-0">
      <style jsx>{`
        .gcp-marker {
          z-index: 1000 !important;
          pointer-events: auto !important;
        }
        .marker-wrapper {
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
        }
        .leaflet-marker-icon {
          z-index: 1000 !important;
        }
        .leaflet-pane.leaflet-marker-pane {
          z-index: 1003 !important;
        }
      `}</style>

      {manifest.items[currentCanvas] &&
        !isImageCanvas(manifest.items[currentCanvas]) && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
            <div className="text-center p-6 bg-card border border-border rounded-lg shadow-lg max-w-md mx-4">
              <h3 className="font-medium mb-2">Map View Not Available</h3>
              <p className="text-sm text-muted-foreground">
                Map visualization is only available for image content. This item
                contains {getCanvasContentType(manifest.items[currentCanvas])}{' '}
                content.
              </p>
            </div>
          </div>
        )}

      {isLoadingMaps && (
        <div className="absolute top-4 left-4 z-[1000] bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-muted border-t-primary"></div>
            Loading georeferenced maps...
          </div>
        </div>
      )}

      {loadedMapsCount > 0 && !isLoadingMaps && (
        <div className="absolute top-4 left-4 z-[1000] bg-secondary/90 border border-border rounded-lg shadow-lg p-2">
          <div className="text-sm text-secondary-foreground">
            {loadedMapsCount} georeferenced map
            {loadedMapsCount !== 1 ? 's' : ''} loaded
          </div>
        </div>
      )}

      {initialized &&
        mapRef.current &&
        warpedRef.current &&
        markersRef.current &&
        polygonRef.current && (
          <MapControls
            map={mapRef.current}
            overlay={warpedRef.current}
            markers={markersRef.current}
            polygon={polygonRef.current}
            opacity={opacity}
            onOpacityChange={setOpacity}
          />
        )}

      <div
        ref={container}
        className="w-full h-full absolute top-0 left-0"
        style={{ zIndex: 1000 }}
      />
    </div>
  );
}
