'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { getManifestCanvases, getCanvasImageInfo } from '@/lib/iiif-helpers';
import type { Annotation } from '@/lib/types';
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
  linkingMode?: boolean;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  showAnnotations?: boolean;
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
  linkingMode = false,
  selectedIds = [],
  onSelectedIdsChange,
  showAnnotations = true,
}: ImageViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const osdRef = useRef<any>(null);
  const overlaysRef = useRef<HTMLDivElement[]>([]);
  const vpRectsRef = useRef<Record<string, any>>({});
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onAnnotationSelect);
  const selectedIdRef = useRef<string | null>(selectedAnnotationId);
  const selectedIdsRef = useRef<string[]>(selectedIds);
  const annotationsRef = useRef<Annotation[]>(annotations);

  const lastViewportRef = useRef<any>(null);

  const svgShapeToPoints = (element: Element): number[][] | null => {
    if (element.tagName === 'polygon') {
      const pointsAttr = element.getAttribute('points');
      if (!pointsAttr) return null;
      return pointsAttr
        .trim()
        .split(/\s+/)
        .map((pt) => pt.split(',').map(Number));
    } else if (element.tagName === 'rect') {
      const x = parseFloat(element.getAttribute('x') || '0');
      const y = parseFloat(element.getAttribute('y') || '0');
      const w = parseFloat(element.getAttribute('width') || '0');
      const h = parseFloat(element.getAttribute('height') || '0');
      return [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ];
    } else if (element.tagName === 'circle') {
      const cx = parseFloat(element.getAttribute('cx') || '0');
      const cy = parseFloat(element.getAttribute('cy') || '0');
      const r = parseFloat(element.getAttribute('r') || '0');
      return Array.from({ length: 8 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 8;
        return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
      });
    }
    return null;
  };

  function styleOverlays() {
    window.requestAnimationFrame(() => {
      overlaysRef.current.forEach((d) => {
        const id = d.dataset.annotationId;
        let isSel = false;
        let isLinked = false;
        let linkedIds: string[] = [];
        const currentSelectedId = selectedIdRef.current;
        const currentAnnotations = annotationsRef.current;

        if (currentSelectedId) {
          const linkingAnnos = currentAnnotations.filter(
            (a) =>
              a.motivation === 'linking' &&
              Array.isArray(a.target) &&
              a.target.includes(currentSelectedId),
          );
          linkingAnnos.forEach((link) => {
            (link.target || []).forEach((tid: string) => {
              if (tid !== currentSelectedId) linkedIds.push(tid);
            });
          });
        }
        if (
          id &&
          linkingMode &&
          selectedIdsRef.current &&
          selectedIdsRef.current.length > 0
        ) {
          isSel = selectedIdsRef.current.includes(id);
        } else {
          isSel = id === currentSelectedId;
        }
        if (id && currentSelectedId && linkedIds.includes(id)) {
          isLinked = true;
        }
        if (isSel) {
          d.style.backgroundColor = 'rgba(255,0,0,0.3)';
          d.style.border = '2px solid rgba(255,0,0,0.8)';
        } else if (isLinked) {
          d.style.backgroundColor = 'rgba(150,0,0,0.4)';
          d.style.border = '2px solid rgba(150,0,0,0.9)';
        } else {
          d.style.backgroundColor = 'rgba(0,100,255,0.2)';
          d.style.border = '1px solid rgba(0,100,255,0.6)';
        }
      });
    });
  }

  useEffect(() => {
    onSelectRef.current = onAnnotationSelect;
  }, [onAnnotationSelect]);

  useEffect(() => {
    selectedIdRef.current = selectedAnnotationId;
    if (viewerRef.current) {
      styleOverlays();
      if (selectedAnnotationId) {
        zoomToSelected();
      }
    }
  }, [selectedAnnotationId]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
    if (viewerRef.current) {
      styleOverlays();
    }
  }, [selectedIds]);

  useEffect(() => {
    annotationsRef.current = annotations;
    if (viewerRef.current) {
      styleOverlays();
    }
  }, [annotations]);

  useEffect(() => {
    if (viewerRef.current && viewerRef.current.viewport) {
      lastViewportRef.current = viewerRef.current.viewport.getBounds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations.length]);

  const [loading, setLoading] = useState(true);
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
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    if (tooltipRef.current) {
      tooltipRef.current.remove();
      tooltipRef.current = null;
    }

    const { service, url } = getCanvasImageInfo(canvas);

    if (!service && !url) {
      setLoading(false);
      setNoSource(true);
      return;
    }

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
        const { default: OpenSeadragon } = await import('openseadragon');
        osdRef.current = OpenSeadragon;

        const viewer = OpenSeadragon({
          element: container!,
          prefixUrl: '//openseadragon.github.io/openseadragon/images/',
          tileSources: service
            ? ({
                '@context': 'http://iiif.io/api/image/2/context.json',
                '@id': service['@id'] || service.id,
                width: canvas.width,
                height: canvas.height,
                profile: ['http://iiif.io/api/image/2/level2.json'],
                protocol: 'http://iiif.io/api/image',
                tiles: [{ scaleFactors: [1, 2, 4, 8], width: 512 }],
              } as any)
            : ({
                type: 'image',
                url: getProxiedUrl(url),
                buildPyramid: false,
              } as any),
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
          immediateRender: true,
          showNavigator: true,
          navigatorPosition: 'BOTTOM_RIGHT',
          navigatorHeight: 100,
          navigatorWidth: 150,
          navigatorBackground: '#F1F5F9',
          navigatorBorderColor: '#CBD5E1',
        });

        viewer.addHandler('canvas-click', (evt: any) => {
          evt.preventDefaultAction = true;
        });

        viewerRef.current = viewer;
        onViewerReady?.(viewer);

        viewer.addHandler('open', () => {
          setLoading(false);
          if (lastViewportRef.current) {
            viewer.viewport.fitBounds(lastViewportRef.current, true);
            lastViewportRef.current = null;
          }
          if (annotations.length) {
            addOverlays();
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
          const tt = tooltipRef.current;
          if (!tt) return;
          const offset = 10;
          tt.style.left = `${e.pageX + offset}px`;
          tt.style.top = `${e.pageY + offset}px`;
          const r = tt.getBoundingClientRect();
          if (r.right > window.innerWidth)
            tt.style.left = `${e.pageX - r.width - offset}px`;
          if (r.bottom > window.innerHeight)
            tt.style.top = `${e.pageY - r.height - offset}px`;
        };

        function svgShapeToPoints(element: Element): number[][] | null {
          if (element.tagName === 'polygon') {
            const pointsAttr = element.getAttribute('points');
            if (!pointsAttr) return null;
            return pointsAttr
              .trim()
              .split(/\s+/)
              .map((pt) => pt.split(',').map(Number));
          } else if (element.tagName === 'rect') {
            const x = parseFloat(element.getAttribute('x') || '0');
            const y = parseFloat(element.getAttribute('y') || '0');
            const w = parseFloat(element.getAttribute('width') || '0');
            const h = parseFloat(element.getAttribute('height') || '0');
            return [
              [x, y],
              [x + w, y],
              [x + w, y + h],
              [x, y + h],
            ];
          } else if (element.tagName === 'circle') {
            const cx = parseFloat(element.getAttribute('cx') || '0');
            const cy = parseFloat(element.getAttribute('cy') || '0');
            const r = parseFloat(element.getAttribute('r') || '0');
            return Array.from({ length: 8 }, (_, i) => {
              const angle = (Math.PI * 2 * i) / 8;
              return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
            });
          }
          return null;
        }

        function addOverlays() {
          viewer.clearOverlays();
          overlaysRef.current = [];
          vpRectsRef.current = {};

          if (!showAnnotations) {
            return;
          }

          let processedCount = 0;
          let renderedCount = 0;

          for (const anno of annotations) {
            processedCount++;
            if (!anno || !anno.id || !anno.target) {
              continue;
            }
            const m = anno.motivation?.toLowerCase();

            if (m === 'iconography' || m === 'iconograpy') {
              console.log(
                '🎨 Processing iconography annotation in ImageViewer:',
                {
                  id: anno.id,
                  motivation: anno.motivation,
                  showIconography,
                  willRender: showIconography,
                  target: anno.target,
                  body: anno.body,
                },
              );
            }

            if (m === 'textspotting' && !showTextspotting) {
              continue;
            }
            if (
              (m === 'iconography' || m === 'iconograpy') &&
              !showIconography
            ) {
              console.log(
                '🚫 Skipping iconography annotation (showIconography=false):',
                anno.id,
              );
              continue;
            }

            if (m === 'linking') {
              continue;
            }

            let svgVal: string | null = null;
            const sel = anno.target?.selector;
            if (sel) {
              if (sel.type === 'SvgSelector') svgVal = sel.value;
              else if (Array.isArray(sel)) {
                const f = sel.find((s: any) => s.type === 'SvgSelector');
                if (f) svgVal = f.value;
              }
            }
            if (!svgVal) {
              continue;
            }

            let coords: number[][] | null = null;
            try {
              const doc = new window.DOMParser().parseFromString(
                svgVal,
                'image/svg+xml',
              );
              const shapeTags = ['polygon', 'rect', 'circle'];
              for (const tag of shapeTags) {
                const el = doc.querySelector(tag);
                if (el) {
                  coords = svgShapeToPoints(el);
                  if (coords) break;
                }
              }
            } catch (e) {}
            if (!coords) {
              const match = svgVal.match(/<polygon points="([^"]+)"/);
              if (match) {
                coords = match[1]
                  .trim()
                  .split(/\s+/)
                  .map((pt) => pt.split(',').map(Number));
              }
            }
            if (!coords || !coords.length) continue;
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
            if (
              !isFinite(x) ||
              !isFinite(y) ||
              !isFinite(w) ||
              !isFinite(h) ||
              w <= 0 ||
              h <= 0
            )
              continue;

            const imgRect = new OpenSeadragon.Rect(x, y, w, h);
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
              cursor: linkingMode ? 'pointer' : 'pointer',
            });

            if (linkingMode && selectedIds && selectedIds.length > 0) {
              const idx = selectedIds.indexOf(anno.id);
              if (idx !== -1) {
                const badgeOverlay = document.createElement('div');
                badgeOverlay.textContent = String(idx + 1);
                Object.assign(badgeOverlay.style, {
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  background: 'rgba(255,0,0,0.95)',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                  zIndex: '200',
                  pointerEvents: 'none',
                  border: '3px solid white',
                  transform: 'translate(4px, 4px)',
                });
                viewer.addOverlay({
                  element: badgeOverlay,
                  location: new OpenSeadragon.Rect(vpRect.x, vpRect.y, 0, 0),
                });
              }
            } else if (selectedAnnotationId) {
              let linkedIds: string[] = [];
              const linkingAnnos = annotations.filter(
                (a) =>
                  a.motivation === 'linking' &&
                  Array.isArray(a.target) &&
                  a.target.includes(selectedAnnotationId),
              );
              linkingAnnos.forEach((link) => {
                (link.target || []).forEach((tid: string) => {
                  if (tid !== selectedAnnotationId) linkedIds.push(tid);
                });
              });

              const linkedIdx = linkedIds.indexOf(anno.id);
              if (linkedIdx !== -1) {
                const badgeOverlay = document.createElement('div');
                badgeOverlay.textContent = String(linkedIdx + 1);
                Object.assign(badgeOverlay.style, {
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  background: 'rgba(150,0,0,0.95)',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                  zIndex: '200',
                  pointerEvents: 'none',
                  border: '3px solid white',
                  transform: 'translate(4px, 4px)',
                });
                viewer.addOverlay({
                  element: badgeOverlay,
                  location: new OpenSeadragon.Rect(vpRect.x, vpRect.y, 0, 0),
                });
              }
            }

            const textBody = Array.isArray(anno.body)
              ? anno.body.find((b) => b.type === 'TextualBody')
              : (anno.body as any);
            if (textBody?.value) div.dataset.tooltipText = textBody.value;

            div.addEventListener('pointerdown', (e) => e.stopPropagation());
            div.addEventListener('click', (e) => {
              e.stopPropagation();
              if (linkingMode && onSelectedIdsChange) {
                const id = anno.id;
                const current = selectedIdsRef.current;
                if (current.includes(id)) {
                  onSelectedIdsChange(current.filter((x) => x !== id));
                } else {
                  onSelectedIdsChange([...current, id]);
                }
              } else {
                onSelectRef.current?.(anno.id);
              }
            });
            div.addEventListener('mouseenter', (e) => {
              const tt = tooltipRef.current;
              if (div.dataset.tooltipText && tt) {
                tt.textContent = div.dataset.tooltipText;
                tt.style.display = 'block';
                updateTooltip(e);
              }
            });
            div.addEventListener('mousemove', updateTooltip);
            div.addEventListener('mouseleave', () => {
              const tt = tooltipRef.current;
              if (tt) {
                tt.style.display = 'none';
              }
            });

            viewer.addOverlay({ element: div, location: vpRect });
            overlaysRef.current.push(div);
            renderedCount++;
          }
          styleOverlays();
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
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch (e) {}
        viewerRef.current = null;
      }
      overlaysRef.current = [];
      vpRectsRef.current = {};
      if (mountRef.current) {
        while (mountRef.current.firstChild) {
          mountRef.current.removeChild(mountRef.current.firstChild);
        }
      }
      if (tooltipRef.current) {
        tooltipRef.current.remove();
        tooltipRef.current = null;
      }
    };
  }, [
    manifest,
    currentCanvas,
    annotations,
    showTextspotting,
    showIconography,
    linkingMode,
    selectedIds,
    onSelectedIdsChange,
    showAnnotations,
  ]);

  return (
    <div
      className={cn('w-full h-full relative')}
      key={`osd-canvas-${currentCanvas}`}
      style={
        linkingMode
          ? {
              cursor:
                "url(\"data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='16' cy='16' r='15' fill='%23F7F7F7' stroke='%2322524A' stroke-width='2'/%3E%3Cpath d='M16 10V22M10 16H22' stroke='%2322524A' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E\") 16 16, copy",
            }
          : {}
      }
    >
      <div ref={mountRef} className="w-full h-full" />

      {loading && annotations.length > 0 && (
        <div className="absolute inset-0 bg-white bg-opacity-40 z-20 flex items-center justify-center pointer-events-none">
          <LoadingSpinner />
        </div>
      )}
      {loading && annotations.length === 0 && (
        <div className="absolute inset-0 bg-white bg-opacity-75 z-50 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      )}
      {noSource && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-red-500">No image source found</div>
        </div>
      )}
      {errorMsg && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-red-500 p-2">
            Error loading viewer: {errorMsg}
          </div>
        </div>
      )}
    </div>
  );
}
