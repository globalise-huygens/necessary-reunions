'use client';

import { getCanvasImageInfo, getManifestCanvases } from '@/lib/iiif-helpers';
import type { Annotation } from '@/lib/types';
import { cn } from '@/lib/utils';
import React, { useEffect, useRef, useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface ImageViewerProps {
  manifest: any;
  currentCanvas: number;
  annotations?: Annotation[];
  selectedAnnotationId?: string | null;
  onAnnotationSelect?: (id: string) => void;
  onViewerReady?: (viewer: any) => void;
  showTextspotting: boolean;
  showIconography: boolean;
}

export function ImageViewer({
  manifest,
  currentCanvas,
  annotations = [],
  selectedAnnotationId = null,
  onAnnotationSelect,
  onViewerReady,
  showTextspotting,
  showIconography,
}: ImageViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const osdRef = useRef<any>(null);
  const overlaysRef = useRef<HTMLDivElement[]>([]);
  const vpRectsRef = useRef<Record<string, any>>({});
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onAnnotationSelect);
  const selectedIdRef = useRef<string | null>(selectedAnnotationId);

  const lastViewportRef = useRef<any>(null);

  useEffect(() => {
    onSelectRef.current = onAnnotationSelect;
  }, [onAnnotationSelect]);

  useEffect(() => {
    selectedIdRef.current = selectedAnnotationId;
  }, [selectedAnnotationId]);

  useEffect(() => {
    if (viewerRef.current && viewerRef.current.viewport) {
      lastViewportRef.current = viewerRef.current.viewport.getBounds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations.length]);

  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [noSource, setNoSource] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const zoomToSelected = () => {
    const id = selectedIdRef.current;
    const viewer = viewerRef.current;
    const osd = osdRef.current;
    if (!viewer || !osd || !id) return;
    const vpRect = vpRectsRef.current[id];
    if (!vpRect) return;

    const Rect = osd.Rect;
    const factor = 7;
    const expanded = new Rect(
      vpRect.x - (vpRect.width * (factor - 1)) / 2,
      vpRect.y - (vpRect.height * (factor - 1)) / 2,
      vpRect.width * factor,
      vpRect.height * factor,
    );

    viewer.viewport.fitBounds(expanded, true);
  };

  useEffect(() => {
    if (tooltipRef.current) return;
    const tip = document.createElement('div');
    tip.className = 'annotation-tooltip';
    Object.assign(tip.style, {
      position: 'absolute',
      display: 'none',
      backgroundColor: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      zIndex: '20',
      pointerEvents: 'none',
    });
    document.body.appendChild(tip);
    tooltipRef.current = tip;
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    const canvases = getManifestCanvases(manifest);
    const canvas = canvases[currentCanvas];
    if (!container || !canvas) return;

    setLoading(true);
    setLoadingProgress(0);
    setLoadingStatus('Initializing...');
    setNoSource(false);
    setErrorMsg(null);

    if (viewerRef.current) {
      try {
        viewerRef.current.destroy();
      } catch (e) {}
      viewerRef.current = null;
    }
    overlaysRef.current = [];
    vpRectsRef.current = {};

    const { service, url } = getCanvasImageInfo(canvas);

    if (!service && !url) {
      setLoading(false);
      setNoSource(true);
      return;
    }

    let isCancelled = false;

    const needsProxy = (imageUrl: string): boolean => {
      if (!imageUrl) return false;
      try {
        const urlObj = new URL(imageUrl);
        const currentOrigin = window.location.origin;
        return urlObj.origin !== currentOrigin;
      } catch {
        return false;
      }
    };

    const getProxiedUrl = (imageUrl: string): string => {
      if (!needsProxy(imageUrl)) return imageUrl;
      return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    };

    async function initViewer() {
      try {
        if (isCancelled) return;

        const waitForContainer = () => {
          return new Promise<void>((resolve, reject) => {
            if (!container || isCancelled) {
              reject(new Error('Container not found or operation cancelled'));
              return;
            }

            let attempts = 0;
            const maxAttempts = 50;

            const checkDimensions = () => {
              if (isCancelled) {
                reject(new Error('Operation cancelled'));
                return;
              }

              if (!container) {
                reject(new Error('Container element lost'));
                return;
              }

              const rect = container.getBoundingClientRect();
              const parentRect =
                container.parentElement?.getBoundingClientRect();

              const hasValidDimensions =
                container.clientHeight > 0 &&
                container.clientWidth > 0 &&
                rect.height > 0 &&
                rect.width > 0 &&
                (parentRect?.height || 0) > 0 &&
                (parentRect?.width || 0) > 0;

              if (hasValidDimensions) {
                resolve();
                return;
              }

              attempts++;
              if (attempts >= maxAttempts) {
                reject(
                  new Error(
                    `Container failed to get proper dimensions after ${maxAttempts} attempts`,
                  ),
                );
                return;
              }

              setTimeout(checkDimensions, 100);
            };

            checkDimensions();
          });
        };

        await waitForContainer();
        setLoadingProgress(20);
        setLoadingStatus('Container ready, preparing image...');

        if (isCancelled) return;

        if (
          !container ||
          container.clientHeight <= 0 ||
          container.clientWidth <= 0
        ) {
          throw new Error(
            `Container has invalid dimensions: ${container?.clientWidth || 0}x${
              container?.clientHeight || 0
            }`,
          );
        }

        const canvasWidth =
          typeof canvas.width === 'string'
            ? parseInt(canvas.width, 10)
            : canvas.width;
        const canvasHeight =
          typeof canvas.height === 'string'
            ? parseInt(canvas.height, 10)
            : canvas.height;

        const { default: OpenSeadragon } = await import('openseadragon');
        osdRef.current = OpenSeadragon;

        let tileSource;
        if (service) {
          if (
            !canvasWidth ||
            !canvasHeight ||
            canvasWidth <= 0 ||
            canvasHeight <= 0
          ) {
            throw new Error(
              `Invalid canvas dimensions: ${canvasWidth}x${canvasHeight}`,
            );
          }

          const serviceId = service['@id'] || service.id;

          const needsServiceProxy = (serviceUrl: string): boolean => {
            if (!serviceUrl) return false;
            try {
              const urlObj = new URL(serviceUrl);
              const currentOrigin = window.location.origin;
              return (
                urlObj.origin !== currentOrigin ||
                urlObj.hostname.includes('archief.nl') ||
                urlObj.hostname.includes('service.archief.nl')
              );
            } catch {
              return false;
            }
          };

          if (needsServiceProxy(serviceId)) {
            tileSource = {
              type: 'image',
              url: getProxiedUrl(`${serviceId}/full/max/0/default.jpg`),
              buildPyramid: false,
            };
          } else {
            tileSource = {
              '@context': 'http://iiif.io/api/image/2/context.json',
              '@id': serviceId,
              width: canvasWidth,
              height: canvasHeight,
              profile: ['http://iiif.io/api/image/2/level2.json'],
              protocol: 'http://iiif.io/api/image',
              tiles: [{ scaleFactors: [1, 2, 4, 8, 16], width: 512 }],
            };
          }
        } else if (url) {
          tileSource = {
            type: 'image',
            url: getProxiedUrl(url),
            buildPyramid: false,
          };
        } else {
          throw new Error('No valid tile source available');
        }

        setLoadingProgress(40);
        setLoadingStatus('Initializing viewer...');

        const viewer = OpenSeadragon({
          element: container!,
          prefixUrl: '//openseadragon.github.io/openseadragon/images/',
          tileSources: tileSource as any,
          crossOriginPolicy: 'Anonymous',
          gestureSettingsMouse: {
            scrollToZoom: true,
            clickToZoom: false,
            dblClickToZoom: true,
            pinchToZoom: true,
          },
          gestureSettingsTouch: {
            scrollToZoom: false,
            clickToZoom: false,
            dblClickToZoom: true,
            pinchToZoom: true,
          },
          showNavigationControl: false,
          animationTime: 0,
          immediateRender: false,
          preserveImageSizeOnResize: true,
          showNavigator: true,
          navigatorPosition: 'BOTTOM_RIGHT',
          navigatorHeight: 100,
          navigatorWidth: 150,
          navigatorBackground: '#F1F5F9',
          navigatorBorderColor: '#CBD5E1',
          timeout: 30000, // Reduced from 60s to 30s
          loadTilesWithAjax: true,
          ajaxWithCredentials: false,
          maxImageCacheCount: 200,
          constrainDuringPan: true,
          visibilityRatio: 0.1,
          minZoomLevel: 0.1,
          maxZoomLevel: 10,
          defaultZoomLevel: 0,
          homeFillsViewer: false,
          autoResize: true,
        });

        viewer.addHandler('open-failed', (event: any) => {
          setLoading(false);
          setErrorMsg(
            `Failed to open image: ${event.message || 'Unknown error'}`,
          );
        });

        viewer.addHandler('tile-load-failed', (event: any) => {});

        let tilesLoaded = 0;
        let tilesTotal = 0;

        const estimateTotalTiles = () => {
          if (service && canvasWidth && canvasHeight) {
            const tileSize = 512;
            const maxLevel = Math.ceil(
              Math.log2(Math.max(canvasWidth, canvasHeight) / tileSize),
            );
            tilesTotal = Math.max(
              Math.ceil((canvasWidth / tileSize) * (canvasHeight / tileSize)),
              1,
            );
          } else {
            tilesTotal = 1;
          }
        };

        estimateTotalTiles();

        viewer.addHandler('tile-loaded', () => {
          tilesLoaded++;
          const progress = Math.min(
            60 + (tilesLoaded / Math.max(tilesTotal, tilesLoaded)) * 30,
            90,
          );
          setLoadingProgress(progress);
          setLoadingStatus(`Loading tiles... (${tilesLoaded})`);
        });

        viewer.addHandler('canvas-click', (evt: any) => {
          evt.preventDefaultAction = true;
        });

        viewerRef.current = viewer;
        setLoadingProgress(60);
        setLoadingStatus('Loading image tiles...');
        onViewerReady?.(viewer);

        viewer.addHandler('open', () => {
          setLoadingProgress(100);
          setLoadingStatus('Complete');
          setTimeout(() => setLoading(false), 500);
          if (lastViewportRef.current) {
            viewer.viewport.fitBounds(lastViewportRef.current, true);
            lastViewportRef.current = null;
          }
          if (annotations.length) {
            addOverlays();
            overlaysRef.current.forEach((d) => {
              const isSel = d.dataset.annotationId === selectedAnnotationId;
              d.style.backgroundColor = isSel
                ? 'rgba(255,0,0,0.3)'
                : 'rgba(0,100,255,0.2)';
              d.style.border = isSel
                ? '2px solid rgba(255,0,0,0.8)'
                : '1px solid rgba(0,100,255,0.6)';
            });
            zoomToSelected();
          }
        });

        container?.addEventListener('click', (e: MouseEvent) => {
          const el = (e.target as HTMLElement).closest(
            '[data-annotation-id]',
          ) as HTMLElement;
          if (el?.dataset.annotationId) {
            e.stopPropagation();
            onSelectRef.current?.(el.dataset.annotationId);
          }
        });

        const updateTooltip = (e: MouseEvent) => {
          const tt = tooltipRef.current!;
          const offset = 10;
          tt.style.left = `${e.pageX + offset}px`;
          tt.style.top = `${e.pageY + offset}px`;
          const r = tt.getBoundingClientRect();
          if (r.right > window.innerWidth)
            tt.style.left = `${e.pageX - r.width - offset}px`;
          if (r.bottom > window.innerHeight)
            tt.style.top = `${e.pageY - r.height - offset}px`;
        };

        function addOverlays() {
          viewer.clearOverlays();
          overlaysRef.current = [];
          vpRectsRef.current = {};

          for (const anno of annotations) {
            const m = anno.motivation?.toLowerCase();
            if (m === 'textspotting' && !showTextspotting) continue;
            if ((m === 'iconography' || m === 'iconograpy') && !showIconography)
              continue;

            let svgVal: string | null = null;
            const sel = anno.target?.selector;
            if (sel) {
              if (sel.type === 'SvgSelector') svgVal = sel.value;
              else if (Array.isArray(sel)) {
                const f = sel.find((s: any) => s.type === 'SvgSelector');
                if (f) svgVal = f.value;
              }
            }
            if (!svgVal) continue;

            const match = svgVal.match(/<polygon points="([^\"]+)"/);
            if (!match) continue;

            const coords = match[1]
              .trim()
              .split(/\s+/)
              .map((pt) => pt.split(',').map(Number));
            const bbox = coords.reduce(
              (r, [x, y]) => ({
                minX: Math.min(r.minX, x),
                minY: Math.min(r.minY, y),
                maxX: Math.max(r.maxX, x),
                maxY: Math.max(r.maxY, y),
              }),
              {
                minX: Infinity,
                minY: Infinity,
                maxX: -Infinity,
                maxY: -Infinity,
              },
            );
            const [x, y, w, h] = [
              bbox.minX,
              bbox.minY,
              bbox.maxX - bbox.minX,
              bbox.maxY - bbox.minY,
            ];

            const normalizedX = x / canvasWidth;
            const normalizedY = y / canvasHeight;
            const normalizedW = w / canvasWidth;
            const normalizedH = h / canvasHeight;

            const imgRect = new OpenSeadragon.Rect(
              normalizedX,
              normalizedY,
              normalizedW,
              normalizedH,
            );
            const vpRect = viewer.viewport.imageToViewportRectangle(imgRect);
            vpRectsRef.current[anno.id] = vpRect;

            const div = document.createElement('div');
            div.dataset.annotationId = anno.id;
            Object.assign(div.style, {
              position: 'absolute',
              pointerEvents: 'auto',
              zIndex: '20',
              clipPath: `polygon(${coords
                .map(
                  ([cx, cy]) =>
                    `${((cx - x) / w) * 100}% ${((cy - y) / h) * 100}%`,
                )
                .join(',')})`,
              cursor: 'pointer',
            });

            const textBody = Array.isArray(anno.body)
              ? anno.body.find((b) => b.type === 'TextualBody')
              : (anno.body as any);
            if (textBody?.value) div.dataset.tooltipText = textBody.value;

            div.addEventListener('pointerdown', (e) => e.stopPropagation());
            div.addEventListener('click', (e) => {
              e.stopPropagation();
              onSelectRef.current?.(anno.id);
            });
            div.addEventListener('mouseenter', (e) => {
              const tt = tooltipRef.current!;
              if (div.dataset.tooltipText) {
                tt.textContent = div.dataset.tooltipText;
                tt.style.display = 'block';
                updateTooltip(e);
              }
            });
            div.addEventListener('mousemove', updateTooltip);
            div.addEventListener('mouseleave', () => {
              tooltipRef.current!.style.display = 'none';
            });

            viewer.addOverlay({ element: div, location: vpRect });
            overlaysRef.current.push(div);
          }
        }

        viewer.addHandler('animation', () => {
          overlaysRef.current.forEach((d) => {
            const vpRect = vpRectsRef.current[d.dataset.annotationId!];
            viewer.updateOverlay(d, vpRect);
          });
        });
      } catch (err: any) {
        setLoading(false);
        setErrorMsg(err.message);
      }
    }

    initViewer();

    return () => {
      isCancelled = true;
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch (e) {}
        viewerRef.current = null;
      }
      overlaysRef.current = [];
      vpRectsRef.current = {};
    };
  }, [manifest, currentCanvas, annotations, showTextspotting, showIconography]);

  useEffect(() => {
    if (!viewerRef.current) return;

    overlaysRef.current.forEach((d) => {
      const isSel = d.dataset.annotationId === selectedAnnotationId;
      d.style.backgroundColor = isSel
        ? 'rgba(255,0,0,0.3)'
        : 'rgba(0,100,255,0.2)';
      d.style.border = isSel
        ? '2px solid rgba(255,0,0,0.8)'
        : '1px solid rgba(0,100,255,0.6)';
    });

    zoomToSelected();
  }, [selectedAnnotationId]);

  return (
    <div className={cn('w-full h-full relative')}>
      <div ref={mountRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-card p-8 rounded-xl shadow-lg border border-border flex flex-col items-center space-y-4 max-w-sm w-full mx-4">
            <LoadingSpinner />
            <div className="text-sm text-foreground font-medium text-center">
              {loadingStatus}
            </div>
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {Math.round(loadingProgress)}%
            </div>
          </div>
        </div>
      )}
      {noSource && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <div className="bg-card p-6 rounded-xl shadow-lg border border-border">
            <div className="text-destructive font-medium">
              No image source found
            </div>
          </div>
        </div>
      )}
      {errorMsg && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <div className="bg-card p-6 rounded-xl shadow-lg border border-border max-w-md mx-4">
            <div className="text-destructive font-medium mb-2">
              Error loading viewer
            </div>
            <div className="text-sm text-muted-foreground">{errorMsg}</div>
          </div>
        </div>
      )}
    </div>
  );
}
