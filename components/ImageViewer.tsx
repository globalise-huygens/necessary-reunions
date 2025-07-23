'use client';

import { getCanvasImageInfo, getManifestCanvases } from '@/lib/iiif-helpers';
import type { Annotation, LinkingAnnotation } from '@/lib/types';
import { cn } from '@/lib/utils';
import { RotateCcw, RotateCw } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { DrawingTools } from './DrawingTools';
import { LoadingSpinner } from './LoadingSpinner';

interface ImageViewerProps {
  manifest: any;
  currentCanvas: number;
  annotations?: Annotation[];
  selectedAnnotationId?: string | null;
  onAnnotationSelect?: (id: string) => void;
  onViewerReady?: (viewer: any) => void;
  onNewAnnotation?: (annotation: Annotation) => void;
  onAnnotationUpdate?: (annotation: Annotation) => void;
  showAITextspotting: boolean;
  showAIIconography: boolean;
  showHumanTextspotting: boolean;
  showHumanIconography: boolean;
  viewMode: 'image' | 'annotation' | 'map' | 'gallery' | 'info';
  preserveViewport?: boolean;
  onViewportStateChange?: (
    state: { center: any; zoom: number; bounds: any } | null,
  ) => void;
  onPointSelect?: (point: { x: number; y: number }) => void;
  isPointSelectionMode?: boolean;
  selectedPoint?: { x: number; y: number } | null;
  linkedAnnotationsOrder?: string[];
  linkingAnnotations?: LinkingAnnotation[];
  isLinkingMode?: boolean;
  selectedAnnotationsForLinking?: string[];
  onAnnotationAddToLinking?: (id: string) => void;
  onAnnotationRemoveFromLinking?: (id: string) => void;
}

export function ImageViewer({
  manifest,
  currentCanvas,
  annotations = [],
  selectedAnnotationId = null,
  onAnnotationSelect,
  onViewerReady,
  onNewAnnotation,
  onAnnotationUpdate,
  showAITextspotting,
  showAIIconography,
  showHumanTextspotting,
  showHumanIconography,
  viewMode,
  preserveViewport = false,
  onViewportStateChange,
  onPointSelect,
  isPointSelectionMode = false,
  selectedPoint = null,
  linkedAnnotationsOrder = [],
  linkingAnnotations = [],
  isLinkingMode = false,
  selectedAnnotationsForLinking = [],
  onAnnotationAddToLinking,
  onAnnotationRemoveFromLinking,
}: ImageViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const osdRef = useRef<any>(null);
  const overlaysRef = useRef<HTMLDivElement[]>([]);
  const vpRectsRef = useRef<Record<string, any>>({});
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onAnnotationSelect);
  const selectedIdRef = useRef<string | null>(selectedAnnotationId);

  const isPointSelectionModeRef = useRef(isPointSelectionMode);
  const onPointSelectRef = useRef(onPointSelect);

  const lastViewportRef = useRef<any>(null);

  const [rotation, setRotation] = useState(0);
  const [isDrawingActive, setIsDrawingActive] = useState(false);

  const isAIGenerated = (annotation: Annotation) => {
    if (annotation.creator) {
      return false;
    }

    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : [annotation.body];
    const textualBodies = bodies.filter((b) => b?.type === 'TextualBody');
    const hasAIGenerator = textualBodies.some(
      (body) =>
        body.generator?.id?.includes('MapTextPipeline') ||
        body.generator?.label?.toLowerCase().includes('loghi') ||
        body.generator?.id?.includes('segment_icons.py'),
    );

    const hasTargetAIGenerator =
      annotation.target?.generator?.id?.includes('segment_icons.py');

    return hasAIGenerator || hasTargetAIGenerator;
  };

  const isHumanCreated = (annotation: Annotation) => {
    return !!annotation.creator;
  };

  const isTextAnnotation = (annotation: Annotation) => {
    return annotation.motivation === 'textspotting';
  };

  const isIconAnnotation = (annotation: Annotation) => {
    return (
      annotation.motivation === 'iconography' ||
      annotation.motivation === 'iconograpy'
    );
  };

  const getBodies = (annotation: Annotation) => {
    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : [annotation.body];
    return bodies.filter((b) => b.type === 'TextualBody');
  };

  const getLoghiBody = (annotation: Annotation) => {
    const bodies = getBodies(annotation);
    return bodies.find(
      (body) =>
        body.generator?.label?.toLowerCase().includes('loghi') ||
        body.generator?.id?.includes('loghi'),
    );
  };

  const getAnnotationText = (annotation: Annotation) => {
    const bodies = getBodies(annotation);
    const loghiBody = getLoghiBody(annotation);
    if (
      annotation.creator &&
      loghiBody &&
      loghiBody.value &&
      loghiBody.value.trim().length > 0
    ) {
      return loghiBody.value;
    }

    const fallbackBody = bodies.find(
      (body) => body.value && body.value.trim().length > 0,
    );
    return fallbackBody?.value || '';
  };

  const shouldShowAnnotation = (annotation: Annotation) => {
    const isAI = isAIGenerated(annotation);
    const isHuman = isHumanCreated(annotation);
    const isText = isTextAnnotation(annotation);
    const isIcon = isIconAnnotation(annotation);

    if (isAI && isText && showAITextspotting) return true;
    if (isAI && isIcon && showAIIconography) return true;
    if (isHuman && isText && showHumanTextspotting) return true;
    if (isHuman && isIcon && showHumanIconography) return true;

    return false;
  };

  const rotateClockwise = () => {
    if (viewerRef.current) {
      const newRotation = (rotation + 90) % 360;
      setRotation(newRotation);
      viewerRef.current.viewport.setRotation(newRotation);
    }
  };

  const rotateCounterClockwise = () => {
    if (viewerRef.current) {
      const newRotation = (rotation - 90 + 360) % 360;
      setRotation(newRotation);
      viewerRef.current.viewport.setRotation(newRotation);
    }
  };

  const [loading, setLoading] = useState(true);
  const [noSource, setNoSource] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const addOverlays = (viewer: any) => {
    viewer.clearOverlays();
    overlaysRef.current = [];
    vpRectsRef.current = {};

    for (const anno of annotations) {
      if (!shouldShowAnnotation(anno)) continue;

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
      const imgRect = new osdRef.current!.Rect(x, y, w, h);
      const vpRect = viewer.viewport.imageToViewportRectangle(imgRect);
      vpRectsRef.current[anno.id] = vpRect;

      const div = document.createElement('div');
      div.dataset.annotationId = anno.id;
      div.dataset.humanModified = anno.creator ? 'true' : 'false';

      const isSel = anno.id === selectedAnnotationId;
      const isHumanModified = anno.creator ? true : false;
      const isLinked = linkedAnnotationsOrder.includes(anno.id);
      const readingOrder = linkedAnnotationsOrder.indexOf(anno.id);
      const isSelectedForLinking = selectedAnnotationsForLinking.includes(
        anno.id,
      );
      const linkingOrder = selectedAnnotationsForLinking.indexOf(anno.id);

      let backgroundColor: string;
      let border: string;
      let cursor: string = 'pointer';

      if (isSel) {
        backgroundColor = 'rgba(255,0,0,0.3)';
        border = '2px solid rgba(255,0,0,0.8)';
      } else if (isSelectedForLinking && isLinkingMode) {
        backgroundColor = 'rgba(212,165,72,0.3)';
        border = '2px solid rgba(212,165,72,0.8)';
      } else if (isLinked) {
        backgroundColor = 'rgba(255,165,0,0.3)';
        border = '2px solid rgba(255,165,0,0.8)';
      } else if (isHumanModified) {
        backgroundColor = 'rgba(174,190,190,0.65)';
        border = '1px solid rgba(174,190,190,0.8)';
      } else {
        backgroundColor = 'rgba(0,100,255,0.2)';
        border = '1px solid rgba(0,100,255,0.6)';
      }

      if (isLinkingMode) {
        cursor = `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72a10 10 0 0 1 1.71 2.43m-3.54-3.54a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72a10 10 0 0 1-1.71-2.43' stroke='%233a5957' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, pointer`;
      }

      Object.assign(div.style, {
        position: 'absolute',
        pointerEvents: isDrawingActive ? 'none' : 'auto',
        zIndex: '20',
        clipPath: `polygon(${coords
          .map(
            ([cx, cy]) => `${((cx - x) / w) * 100}% ${((cy - y) / h) * 100}%`,
          )
          .join(',')})`,
        cursor,
        backgroundColor,
        border,
      });

      if (isSelectedForLinking && isLinkingMode && linkingOrder >= 0) {
        const orderBadge = document.createElement('div');
        orderBadge.textContent = (linkingOrder + 1).toString();
        Object.assign(orderBadge.style, {
          position: 'absolute',
          top: '2px',
          left: '2px',
          backgroundColor: 'rgba(58,89,87,0.9)', // Primary color
          color: 'white',
          borderRadius: '50%',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'bold',
          zIndex: '21',
          pointerEvents: 'none',
        });
        div.appendChild(orderBadge);
      } else if (isLinked && readingOrder >= 0) {
        const orderBadge = document.createElement('div');
        orderBadge.textContent = (readingOrder + 1).toString();
        Object.assign(orderBadge.style, {
          position: 'absolute',
          top: '2px',
          left: '2px',
          backgroundColor: 'rgba(212,165,72,0.9)',
          color: 'white',
          borderRadius: '50%',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'bold',
          zIndex: '21',
          pointerEvents: 'none',
        });
        div.appendChild(orderBadge);
      }

      const tooltipText = getAnnotationText(anno);
      if (tooltipText) div.dataset.tooltipText = tooltipText;

      const textBody = Array.isArray(anno.body)
        ? anno.body.find((b) => b.type === 'TextualBody')
        : (anno.body as any);
      if (textBody?.value) div.dataset.tooltipText = textBody.value;

      div.addEventListener('pointerdown', (e) => e.stopPropagation());
      div.addEventListener('click', (e) => {
        e.stopPropagation();

        if (isLinkingMode) {
          if (isSelectedForLinking) {
            onAnnotationRemoveFromLinking?.(anno.id);
          } else {
            onAnnotationAddToLinking?.(anno.id);
          }
        } else {
          onSelectRef.current?.(anno.id);
        }
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

    if (
      selectedPoint &&
      selectedPoint.x !== undefined &&
      selectedPoint.y !== undefined
    ) {
      const pointDiv = document.createElement('div');
      pointDiv.dataset.isPointOverlay = 'true';

      const pointSize = 8;
      Object.assign(pointDiv.style, {
        position: 'absolute',
        width: `${pointSize}px`,
        height: `${pointSize}px`,
        backgroundColor: 'hsl(45 64% 59% / 0.9)',
        border: '2px solid white',
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: '100',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      });

      if (!viewer.world || viewer.world.getItemCount() === 0) {
        console.warn(
          'ImageViewer: No image loaded, cannot place point overlay',
        );
        return;
      }

      const viewportPoint = viewer.viewport.imageToViewportCoordinates(
        new osdRef.current!.Point(selectedPoint.x, selectedPoint.y),
      );

      console.log('ImageViewer: Direct coordinate conversion', {
        selectedPoint: selectedPoint,
        viewportPoint: viewportPoint,
      });

      viewer.addOverlay({
        element: pointDiv,
        location: viewportPoint,
      });
      overlaysRef.current.push(pointDiv);
    }

    if (linkingAnnotations && linkingAnnotations.length > 0) {
      linkingAnnotations.forEach((linkingAnnotation) => {
        const body = Array.isArray(linkingAnnotation.body)
          ? linkingAnnotation.body
          : [linkingAnnotation.body];

        body.forEach((bodyItem) => {
          if (
            bodyItem.purpose === 'highlighting' &&
            bodyItem.selector &&
            bodyItem.selector.type === 'PointSelector' &&
            typeof bodyItem.selector.x === 'number' &&
            typeof bodyItem.selector.y === 'number'
          ) {
            const pointDiv = document.createElement('div');
            pointDiv.dataset.isLinkingPointOverlay = 'true';

            const pointSize = 10;
            Object.assign(pointDiv.style, {
              position: 'absolute',
              width: `${pointSize}px`,
              height: `${pointSize}px`,
              backgroundColor: 'hsl(165 22% 26% / 0.9)', // Using project primary color
              border: '2px solid white',
              borderRadius: '50%',
              pointerEvents: 'auto',
              zIndex: '99',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              cursor: 'pointer',
            });

            if (!viewer.world || viewer.world.getItemCount() === 0) {
              console.warn(
                'ImageViewer: No image loaded, cannot place linking point overlay',
              );
              return;
            }

            const viewportPoint = viewer.viewport.imageToViewportCoordinates(
              new osdRef.current!.Point(
                bodyItem.selector.x,
                bodyItem.selector.y,
              ),
            );

            pointDiv.addEventListener('mouseenter', () => {
              if (tooltipRef.current) {
                tooltipRef.current.textContent = 'Linked annotation point';
                tooltipRef.current.style.display = 'block';
              }
            });

            pointDiv.addEventListener('mousemove', (e) => {
              if (tooltipRef.current) {
                tooltipRef.current.style.left = e.clientX + 10 + 'px';
                tooltipRef.current.style.top = e.clientY - 30 + 'px';
              }
            });

            pointDiv.addEventListener('mouseleave', () => {
              if (tooltipRef.current) {
                tooltipRef.current.style.display = 'none';
              }
            });

            viewer.addOverlay({
              element: pointDiv,
              location: viewportPoint,
            });
            overlaysRef.current.push(pointDiv);
          }
        });
      });
    }
  };

  const zoomToSelected = () => {
    const id = selectedIdRef.current;
    const viewer = viewerRef.current;
    const osd = osdRef.current;
    if (!viewer || !osd || !id) return;

    if (!vpRectsRef.current[id] && annotations.length > 0) {
      addOverlays(viewer);
    }

    const vpRect = vpRectsRef.current[id];
    if (!vpRect) {
      console.warn(
        'Cannot zoom to annotation, no viewport rectangle found for ID:',
        id,
      );
      return;
    }

    const Rect = osd.Rect;

    const minFactor = 5;
    const maxFactor = 12;

    const annotationSize = vpRect.width * vpRect.height;
    const factor = Math.max(
      minFactor,
      Math.min(
        maxFactor,
        minFactor + 0.0001 / Math.max(0.00001, annotationSize),
      ),
    );

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
    isPointSelectionModeRef.current = isPointSelectionMode;
    onPointSelectRef.current = onPointSelect;

    console.log(
      'ImageViewer: Point selection mode changed to',
      isPointSelectionMode,
      'onPointSelect available:',
      !!onPointSelect,
    );
    if (viewerRef.current && viewerRef.current.canvas) {
      const canvas = viewerRef.current.canvas;
      if (isPointSelectionMode) {
        console.log('ImageViewer: Setting crosshair cursor');
        canvas.style.cursor = `url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='16' cy='16' r='4' fill='%23d4a548' stroke='%23ffffff' stroke-width='2'/%3E%3Cpath d='M16 4v8m0 8v8M4 16h8m8 0h8' stroke='%23d4a548' stroke-width='2' opacity='0.9'/%3E%3C/svg%3E") 16 16, crosshair`;
      } else {
        console.log('ImageViewer: Removing cursor style');
        canvas.style.cursor = '';
      }
    } else {
      console.log(
        'ImageViewer: No viewer or canvas available for cursor change',
      );
    }
  }, [isPointSelectionMode, onPointSelect]);

  useEffect(() => {
    const container = mountRef.current;
    const canvases = getManifestCanvases(manifest);
    const canvas = canvases[currentCanvas];
    if (!container || !canvas) return;

    setLoading(true);
    setNoSource(false);
    setErrorMsg(null);
    setRotation(0);

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
          maxZoomLevel: 20,
          maxZoomPixelRatio: 10,
          minZoomLevel: 0.1,
          defaultZoomLevel: 1,
          zoomPerScroll: 1.4,
          zoomPerClick: 2,
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
          const currentIsPointSelectionMode = isPointSelectionModeRef.current;
          const currentOnPointSelect = onPointSelectRef.current;

          console.log('ImageViewer: Canvas clicked', {
            isPointSelectionMode: currentIsPointSelectionMode,
            hasOnPointSelect: !!currentOnPointSelect,
          });

          if (currentIsPointSelectionMode && currentOnPointSelect) {
            const webPoint = evt.position;

            const viewportPoint = viewer.viewport.pointFromPixel(webPoint);
            const imagePoint =
              viewer.viewport.viewportToImageCoordinates(viewportPoint);
            const imageSize = viewer.world.getItemAt(0).getContentSize();

            const pixelX = Math.round(
              Math.max(0, Math.min(imagePoint.x, imageSize.x)),
            );
            const pixelY = Math.round(
              Math.max(0, Math.min(imagePoint.y, imageSize.y)),
            );

            const point = { x: pixelX, y: pixelY };

            console.log('ImageViewer: Click details (PointSelector method)', {
              originalWebPoint: webPoint,
              viewportPoint: viewportPoint,
              imagePoint: imagePoint,
              imageSize: imageSize,
              clampedPoint: point,
            });
            currentOnPointSelect(point);

            evt.preventDefaultAction = true;
            return;
          }

          evt.preventDefaultAction = true;
        });

        viewerRef.current = viewer;
        (window as any).osdViewer = viewer;
        onViewerReady?.(viewer);

        viewer.addHandler('open', () => {
          setLoading(false);
          viewer.viewport.setRotation(0);
          if (lastViewportRef.current) {
            viewer.viewport.fitBounds(lastViewportRef.current, true);
            lastViewportRef.current = null;
          }
          if (
            annotations.length > 0 &&
            viewMode === 'annotation' &&
            !isDrawingActive
          ) {
            addOverlays(viewer);
            overlaysRef.current.forEach((d) => {
              const isSel = d.dataset.annotationId === selectedAnnotationId;
              const isHumanModified = d.dataset.humanModified === 'true';

              if (isSel) {
                d.style.backgroundColor = 'rgba(255,0,0,0.3)';
                d.style.border = '2px solid rgba(255,0,0,0.8)';
              } else if (isHumanModified) {
                d.style.backgroundColor = 'rgba(174,190,190,0.25)';
                d.style.border = '1px solid rgba(174,190,190,0.8)';
              } else {
                d.style.backgroundColor = 'rgba(0,100,255,0.2)';
                d.style.border = '1px solid rgba(0,100,255,0.6)';
              }
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
        (window as any).osdViewer = null;
      }
      overlaysRef.current = [];
      vpRectsRef.current = {};
    };
  }, [
    manifest,
    currentCanvas,
    annotations,
    showAITextspotting,
    showAIIconography,
    showHumanTextspotting,
    showHumanIconography,
  ]);

  useEffect(() => {
    if (!viewerRef.current) return;

    if (selectedAnnotationId && annotations.length > 0) {
      if (!vpRectsRef.current[selectedAnnotationId]) {
        addOverlays(viewerRef.current);
      }
    }

    overlaysRef.current.forEach((d) => {
      const isSel = d.dataset.annotationId === selectedAnnotationId;
      const isHumanModified = d.dataset.humanModified === 'true';

      if (isSel) {
        d.style.backgroundColor = 'rgba(58,89,87,0.3)';
        d.style.border = '2px solid rgba(58,89,87,0.8)';
      } else if (isHumanModified) {
        d.style.backgroundColor = 'rgba(174,182,182,0.25)';
        d.style.border = '1px solid rgba(174,182,182,0.8)';
      } else {
        d.style.backgroundColor = 'rgba(58,89,87,0.1)';
        d.style.border = '1px solid rgba(58,89,87,0.4)';
      }
    });

    if (!preserveViewport && selectedAnnotationId) {
      setTimeout(() => zoomToSelected(), 50);
    }
  }, [selectedAnnotationId, annotations, preserveViewport]);

  useEffect(() => {
    if (!viewerRef.current) return;

    if (viewMode === 'annotation' && annotations.length > 0) {
      addOverlays(viewerRef.current);
      overlaysRef.current.forEach((d) => {
        const isSel = d.dataset.annotationId === selectedAnnotationId;
        const isHumanModified = d.dataset.humanModified === 'true';

        if (isSel) {
          d.style.backgroundColor = 'rgba(58,89,87,0.3)';
          d.style.border = '2px solid rgba(58,89,87,0.8)';
        } else if (isHumanModified) {
          d.style.backgroundColor = 'rgba(174,182,182,0.25)';
          d.style.border = '1px solid rgba(174,182,182,0.8)';
        } else {
          d.style.backgroundColor = 'rgba(58,89,87,0.1)';
          d.style.border = '1px solid rgba(58,89,87,0.4)';
        }
      });
    } else {
      viewerRef.current.clearOverlays();
      overlaysRef.current = [];
      vpRectsRef.current = {};
    }
  }, [viewMode, annotations, selectedAnnotationId, linkingAnnotations]);

  useEffect(() => {
    overlaysRef.current.forEach((overlay) => {
      overlay.style.pointerEvents = isDrawingActive ? 'none' : 'auto';
    });
  }, [isDrawingActive]);

  useEffect(() => {
    if (viewerRef.current && viewMode === 'annotation') {
      addOverlays(viewerRef.current);
    }
  }, [selectedPoint]);

  useEffect(() => {
    onSelectRef.current = onAnnotationSelect;
    selectedIdRef.current = selectedAnnotationId;

    if (viewMode === 'annotation' && viewerRef.current && !isDrawingActive) {
      addOverlays(viewerRef.current);
    } else if (isDrawingActive && viewerRef.current) {
      viewerRef.current.clearOverlays();
      overlaysRef.current = [];
      vpRectsRef.current = {};
    }
  }, [
    onAnnotationSelect,
    selectedAnnotationId,
    annotations,
    viewMode,
    isDrawingActive,
    linkingAnnotations,
    isLinkingMode,
    selectedAnnotationsForLinking,
    onAnnotationAddToLinking,
    onAnnotationRemoveFromLinking,
  ]);

  const selectedAnnotation =
    annotations.find((a) => a.id === selectedAnnotationId) || null;

  const handleAnnotationUpdate = (updatedAnnotation: any) => {
    if (onAnnotationUpdate) {
      onAnnotationUpdate(updatedAnnotation);
    }
  };

  return (
    <div className={cn('w-full h-full relative')}>
      <DrawingTools
        viewer={viewerRef.current}
        canvasId={getManifestCanvases(manifest)?.[currentCanvas]?.id ?? ''}
        isVisible={viewMode === 'annotation'}
        onNewAnnotation={(annotation) => {
          if (onNewAnnotation) onNewAnnotation(annotation);
        }}
        onDrawingStateChange={setIsDrawingActive}
        selectedAnnotation={selectedAnnotation}
        onAnnotationUpdate={handleAnnotationUpdate}
      />
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

      {/* Rotation Controls */}
      {(viewMode === 'image' || viewMode === 'info') &&
        !loading &&
        !noSource &&
        !errorMsg && (
          <div className="absolute top-2 right-2 z-30 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={rotateCounterClockwise}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2  h-9 rounded-md relative p-2 bg-white text-gray-700 border hover:bg-muted"
              title="Rotate counter-clockwise"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={rotateClockwise}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2  h-9 rounded-md relative p-2 bg-white text-gray-700 border hover:bg-muted"
              title="Rotate clockwise"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        )}
    </div>
  );
}
