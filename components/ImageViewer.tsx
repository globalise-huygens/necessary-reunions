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
  currentPointSelector?: { x: number; y: number } | null;
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
  currentPointSelector = null,
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
  const currentPointSelectorRef = useRef<{ x: number; y: number } | null>(
    currentPointSelector,
  );

  const lastViewportRef = useRef<any>(null);

  useEffect(() => {
    currentPointSelectorRef.current = currentPointSelector;
  }, [currentPointSelector]);

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

        function adjustOverlappingPoints(
          points: Array<{
            x: number;
            y: number;
            id: string;
            annotation?: any;
            selector: any;
            originalSelector: any;
          }>,
        ) {
          const adjustedPoints = [...points];
          const minDistance = 0.01;

          for (let i = 0; i < adjustedPoints.length; i++) {
            for (let j = i + 1; j < adjustedPoints.length; j++) {
              const point1 = adjustedPoints[i];
              const point2 = adjustedPoints[j];

              const dx = point2.x - point1.x;
              const dy = point2.y - point1.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance < minDistance && distance > 0) {
                const angle = Math.atan2(dy, dx);
                const adjustDistance = (minDistance - distance) / 2;

                point1.x -= Math.cos(angle) * adjustDistance;
                point1.y -= Math.sin(angle) * adjustDistance;
                point2.x += Math.cos(angle) * adjustDistance;
                point2.y += Math.sin(angle) * adjustDistance;
              }
            }
          }

          return adjustedPoints;
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

            if (m === 'textspotting' && !showTextspotting) {
              continue;
            }
            if (
              (m === 'iconography' || m === 'iconograpy') &&
              !showIconography
            ) {
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

          const linkingAnnotations = annotations.filter(
            (anno) => anno.motivation === 'linking',
          );

          const allPoints: Array<{
            x: number;
            y: number;
            id: string;
            annotation?: any;
            selector: any;
            originalSelector: any;
          }> = [];

          for (const anno of linkingAnnotations) {
            if (anno.body && Array.isArray(anno.body)) {
              const pointSelectorBody = anno.body.find(
                (b: any) =>
                  b.type === 'SpecificResource' &&
                  b.purpose === 'identifying' &&
                  b.selector &&
                  b.selector.type === 'PointSelector',
              );

              if (pointSelectorBody && pointSelectorBody.selector) {
                const selector = pointSelectorBody.selector;

                if (selector.x !== undefined && selector.y !== undefined) {
                  const imageSize = viewer.world.getItemAt(0).getContentSize();
                  const imageBounds = viewer.world.getItemAt(0).getBounds();

                  const imageX = selector.x;
                  const imageY = selector.y;

                  const vpPoint = viewer.viewport.imageToViewportCoordinates(
                    imageX,
                    imageY,
                  );

                  allPoints.push({
                    x: vpPoint.x,
                    y: vpPoint.y,
                    id: `${anno.id}-point-selector`,
                    annotation: anno,
                    selector: selector,
                    originalSelector: selector,
                  });
                }
              }
            }
          }

          if (
            currentPointSelector &&
            currentPointSelector.x !== undefined &&
            currentPointSelector.y !== undefined
          ) {
            const imageSize = viewer.world.getItemAt(0).getContentSize();
            const imageBounds = viewer.world.getItemAt(0).getBounds();

            const imageX = currentPointSelector.x;
            const imageY = currentPointSelector.y;

            const vpPoint = viewer.viewport.imageToViewportCoordinates(
              imageX,
              imageY,
            );

            allPoints.push({
              x: vpPoint.x,
              y: vpPoint.y,
              id: 'current-point-selector',
              annotation: null,
              selector: currentPointSelector,
              originalSelector: currentPointSelector,
            });
          }

          const adjustedPoints = adjustOverlappingPoints(allPoints);

          adjustedPoints.forEach((pointData) => {
            if (pointData.id === 'current-point-selector') {
              const currentPointDiv = document.createElement('div');
              currentPointDiv.dataset.annotationId = 'current-point-selector';
              currentPointDiv.dataset.pointX = pointData.selector.x.toString();
              currentPointDiv.dataset.pointY = pointData.selector.y.toString();

              const zoom = viewer.viewport.getZoom();
              const baseSize = 12;
              const maxSize = 16;
              const minSize = 8;
              const pointSize = Math.max(
                minSize,
                Math.min(maxSize, baseSize * (1 / Math.max(zoom, 1))),
              );

              Object.assign(currentPointDiv.style, {
                position: 'absolute',
                width: `${pointSize}px`,
                height: `${pointSize}px`,
                background: 'hsl(45, 64%, 59%)',
                border: '3px solid white',
                borderRadius: '50%',
                pointerEvents: 'auto',
                zIndex: '35',
                cursor: 'pointer',
                boxShadow:
                  '0 2px 6px rgba(0,0,0,0.3), 0 0 0 1px rgba(212, 165, 72, 0.4)',
                opacity: '1',
                transition: 'transform 0.2s ease',
              });

              currentPointDiv.addEventListener('mouseenter', (e) => {
                currentPointDiv.style.transform = 'scale(1.2)';
                currentPointDiv.style.zIndex = '40';
                const tt = tooltipRef.current;
                if (tt) {
                  tt.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 4px; color: hsl(45, 64%, 59%);">📍 Current Point Selection</div>
                    <div style="font-size: 11px; color: #ccc;">
                      Coordinates: (${pointData.selector.x}, ${pointData.selector.y})<br/>
                      Click save to persist this location
                    </div>
                  `;
                  tt.style.display = 'block';
                  tt.style.left = e.pageX + 10 + 'px';
                  tt.style.top = e.pageY - 10 + 'px';
                }
              });

              currentPointDiv.addEventListener('mouseleave', () => {
                currentPointDiv.style.transform = 'scale(1)';
                currentPointDiv.style.zIndex = '35';
                const tt = tooltipRef.current;
                if (tt) {
                  tt.style.display = 'none';
                }
              });

              const adjustedVpPoint = new OpenSeadragon.Point(
                pointData.x,
                pointData.y,
              );
              viewer.addOverlay({
                element: currentPointDiv,
                location: adjustedVpPoint,
                placement: OpenSeadragon.Placement.CENTER,
                checkResize: false,
              });
              overlaysRef.current.push(currentPointDiv);
              vpRectsRef.current['current-point-selector'] = adjustedVpPoint;
            } else {
              const anno = pointData.annotation;
              const selector = pointData.selector;

              const pointDiv = document.createElement('div');
              pointDiv.dataset.annotationId = pointData.id;
              pointDiv.dataset.parentAnnotationId = anno.id;
              pointDiv.dataset.pointX = selector.x.toString();
              pointDiv.dataset.pointY = selector.y.toString();

              const zoom = viewer.viewport.getZoom();
              const baseSize = 10;
              const maxSize = 14;
              const minSize = 6;
              const pointSize = Math.max(
                minSize,
                Math.min(maxSize, baseSize * (1 / Math.max(zoom, 1))),
              );

              Object.assign(pointDiv.style, {
                position: 'absolute',
                width: `${pointSize}px`,
                height: `${pointSize}px`,
                background: 'hsl(165, 22%, 26%)', // Project primary color (dark teal)
                border: '2px solid white',
                borderRadius: '50%',
                pointerEvents: 'auto',
                zIndex: '30',
                cursor: 'pointer',
                boxShadow:
                  '0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(51, 107, 94, 0.3)',
                opacity: '0.95',
                transition: 'transform 0.2s ease',
              });

              pointDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                const parentId = pointDiv.dataset.parentAnnotationId;
                if (parentId && onAnnotationSelect) {
                  onAnnotationSelect(parentId);
                }
              });

              pointDiv.addEventListener('mouseenter', (e) => {
                pointDiv.style.transform = 'scale(1.3)';
                pointDiv.style.zIndex = '35';
                const tt = tooltipRef.current;
                if (tt) {
                  tt.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 4px; color: hsl(165, 22%, 26%);">🎯 Saved Map Point</div>
                    <div style="font-size: 11px; color: #ccc;">
                      Coordinates: (${selector.x}, ${selector.y})<br/>
                      Click to edit this linking annotation
                    </div>
                  `;
                  tt.style.display = 'block';
                  tt.style.left = e.pageX + 10 + 'px';
                  tt.style.top = e.pageY - 10 + 'px';
                }
              });

              pointDiv.addEventListener('mouseleave', () => {
                pointDiv.style.transform = 'scale(1)';
                pointDiv.style.zIndex = '30';
                const tt = tooltipRef.current;
                if (tt) {
                  tt.style.display = 'none';
                }
              });

              const adjustedVpPoint = new OpenSeadragon.Point(
                pointData.x,
                pointData.y,
              );
              viewer.addOverlay({
                element: pointDiv,
                location: adjustedVpPoint,
                placement: OpenSeadragon.Placement.CENTER,
                checkResize: false,
              });
              overlaysRef.current.push(pointDiv);
              vpRectsRef.current[pointData.id] = adjustedVpPoint;
            }
          });

          styleOverlays();
        }

        viewer.addHandler('animation', () => {
          overlaysRef.current.forEach((d) => {
            const vpData = vpRectsRef.current[d.dataset.annotationId!];
            if (vpData) {
              if (
                vpData.x !== undefined &&
                vpData.y !== undefined &&
                vpData.width === undefined
              ) {
                viewer.updateOverlay(d, vpData, OpenSeadragon.Placement.CENTER);

                const zoom = viewer.viewport.getZoom();
                const isCurrentPoint =
                  d.dataset.annotationId === 'current-point-selector';
                const baseSize = isCurrentPoint ? 12 : 10;
                const maxSize = isCurrentPoint ? 16 : 14;
                const minSize = isCurrentPoint ? 8 : 6;
                const pointSize = Math.max(
                  minSize,
                  Math.min(maxSize, baseSize * (1 / Math.max(zoom, 1))),
                );

                d.style.width = `${pointSize}px`;
                d.style.height = `${pointSize}px`;
              } else {
                viewer.updateOverlay(d, vpData);
              }
            }
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
