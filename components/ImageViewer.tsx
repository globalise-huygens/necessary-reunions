'use client';

import { getCanvasImageInfo, getManifestCanvases } from '@/lib/iiif-helpers';
import type { Annotation } from '@/lib/types';
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
  // Linking-related props (new functionality)
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
  onNewAnnotation,
  onAnnotationUpdate,
  showAITextspotting,
  showAIIconography,
  showHumanTextspotting,
  showHumanIconography,
  viewMode,
  preserveViewport = false,
  onViewportStateChange,
  // Linking-related props
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
  const linkingModeRef = useRef<boolean>(linkingMode);
  const onSelectedIdsChangeRef = useRef(onSelectedIdsChange);
  const currentPointSelectorRef = useRef<{ x: number; y: number } | null>(
    currentPointSelector,
  );

  const lastViewportRef = useRef<any>(null);

  const [rotation, setRotation] = useState(0);
  const [isDrawingActive, setIsDrawingActive] = useState(false);

  // Update the isAIGenerated function to match main branch logic
  const isAIGenerated = (annotation: Annotation) => {
    // If it has a creator, it's human-created (from main branch)
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

  // Helper function for SVG shape parsing
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

  // Helper function to adjust overlapping points
  const adjustOverlappingPoints = (
    points: Array<{
      x: number;
      y: number;
      id: string;
      annotation?: any;
      selector: any;
      originalSelector: any;
    }>,
  ) => {
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
  };

  // Enhanced overlay styling that combines main branch and linking features
  const styleOverlays = () => {
    window.requestAnimationFrame(() => {
      overlaysRef.current.forEach((d) => {
        const id = d.dataset.annotationId;
        let isSel = false;
        let isLinked = false;
        let linkedIds: string[] = [];
        const currentSelectedId = selectedIdRef.current;
        const currentAnnotations = annotationsRef.current;
        const isHumanModified = d.dataset.humanModified === 'true';

        // Calculate linked annotations
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

        // Determine selection state
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

        // Apply styling based on state (combining main branch and linking logic)
        if (isSel) {
          d.style.backgroundColor = 'rgba(255,0,0,0.3)';
          d.style.border = '2px solid rgba(255,0,0,0.8)';
        } else if (isLinked) {
          d.style.backgroundColor = 'rgba(150,0,0,0.4)';
          d.style.border = '2px solid rgba(150,0,0,0.9)';
        } else if (isHumanModified) {
          // From main branch: special styling for human-modified annotations
          d.style.backgroundColor = 'rgba(174,190,190,0.25)';
          d.style.border = '1px solid rgba(174,190,190,0.8)';
        } else {
          d.style.backgroundColor = 'rgba(0,100,255,0.2)';
          d.style.border = '1px solid rgba(0,100,255,0.6)';
        }
      });
    });
  };

  // Helper function to add overlays - moved outside useEffect for reusability
  const addOverlays = () => {
    const viewer = viewerRef.current;
    const OpenSeadragon = osdRef.current;

    if (!viewer || !OpenSeadragon) return;

    viewer.clearOverlays();
    overlaysRef.current = [];
    vpRectsRef.current = {};

    // Only show overlays in annotation view mode
    if (!showAnnotations || viewMode !== 'annotation') {
      return;
    }

    // Main annotation overlays loop
    for (const anno of annotations) {
      if (!anno || !anno.id || !anno.target) {
        continue;
      }

      // Skip linking annotations in the main overlay loop
      if (anno.motivation === 'linking') {
        continue;
      }

      // Use the shouldShowAnnotation function for proper filtering
      if (!shouldShowAnnotation(anno)) {
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
      if (!coords && svgVal) {
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

      // Mark human-modified annotations (from main branch)
      if (isHumanCreated(anno)) {
        div.dataset.humanModified = 'true';
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
        cursor: linkingMode
          ? "url(\"data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='11' fill='%23ffffff' stroke='%23336B5E' stroke-width='2'/%3E%3Cpath d='M12 6v12M6 12h12' stroke='%23336B5E' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E\") 12 12, crosshair"
          : 'pointer',
      });

      // Add linking selection badges
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
        // Show linked annotation badges when not in linking mode
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
        ? anno.body.find((b: any) => b.type === 'TextualBody')
        : (anno.body as any);
      if (textBody?.value) div.dataset.tooltipText = textBody.value;

      div.addEventListener('pointerdown', (e) => e.stopPropagation());
      div.addEventListener('click', (e) => {
        e.stopPropagation();

        if (linkingModeRef.current && onSelectedIdsChangeRef.current) {
          const id = anno.id;
          const current = selectedIdsRef.current || [];
          if (current.includes(id)) {
            onSelectedIdsChangeRef.current(current.filter((x) => x !== id));
          } else {
            onSelectedIdsChangeRef.current([...current, id]);
          }
        } else {
          onSelectRef.current?.(anno.id);
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
    }

    // Add point selector overlays for linking annotations
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
            const vpPoint = viewer.viewport.imageToViewportCoordinates(
              selector.x,
              selector.y,
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
      const vpPoint = viewer.viewport.imageToViewportCoordinates(
        currentPointSelector.x,
        currentPointSelector.y,
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
          cursor: linkingMode
            ? "url(\"data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='11' fill='%23ffffff' stroke='%23336B5E' stroke-width='2'/%3E%3Cpath d='M12 6v12M6 12h12' stroke='%23336B5E' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E\") 12 12, crosshair"
            : 'pointer',
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
          background: 'hsl(165, 22%, 26%)',
          border: '2px solid white',
          borderRadius: '50%',
          pointerEvents: 'auto',
          zIndex: '30',
          cursor: linkingMode
            ? "url(\"data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='11' fill='%23ffffff' stroke='%23336B5E' stroke-width='2'/%3E%3Cpath d='M12 6v12M6 12h12' stroke='%23336B5E' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E\") 12 12, crosshair"
            : 'pointer',
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

    // Trigger zoom if we're in linking mode with multiple selected annotations
    if (
      linkingModeRef.current &&
      selectedIdsRef.current &&
      selectedIdsRef.current.length > 1
    ) {
      setTimeout(() => {
        zoomToSelected();
      }, 50);
    }
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

  const zoomToSelected = (retryCount = 0) => {
    const viewer = viewerRef.current;
    const osd = osdRef.current;
    if (!viewer || !osd) return;

    // Check if we have multiple selected annotations (linking mode)
    const selectedIds = selectedIdsRef.current;
    const singleId = selectedIdRef.current;

    if (linkingModeRef.current && selectedIds && selectedIds.length > 1) {
      // Zoom to fit all linked annotations
      const validRects = selectedIds
        .map((id) => vpRectsRef.current[id])
        .filter(
          (rect) => rect !== undefined && rect.width > 0 && rect.height > 0,
        );

      // If no valid rects and we haven't retried too many times, retry
      if (validRects.length === 0 && retryCount < 2) {
        setTimeout(() => zoomToSelected(retryCount + 1), 200);
        return;
      }

      // If still no valid rects after retries, give up
      if (validRects.length === 0) {
        console.warn(
          'No valid viewport rectangles found for selected annotations',
        );
        return;
      }

      // Calculate bounding box that contains all annotations
      let minX = Math.min(...validRects.map((r) => r.x));
      let minY = Math.min(...validRects.map((r) => r.y));
      let maxX = Math.max(...validRects.map((r) => r.x + r.width));
      let maxY = Math.max(...validRects.map((r) => r.y + r.height));

      const Rect = osd.Rect;
      const boundingWidth = maxX - minX;
      const boundingHeight = maxY - minY;

      // Ensure minimum size for very small or zero-sized bounds
      const minDimension = 0.1;
      const finalWidth = Math.max(boundingWidth, minDimension);
      const finalHeight = Math.max(boundingHeight, minDimension);

      // Add padding based on the size of the bounding box
      const paddingFactor = 1.5; // 50% padding around the annotations
      const finalX = minX - (finalWidth * (paddingFactor - 1)) / 2;
      const finalY = minY - (finalHeight * (paddingFactor - 1)) / 2;

      const expanded = new Rect(
        finalX,
        finalY,
        finalWidth * paddingFactor,
        finalHeight * paddingFactor,
      );

      viewer.viewport.fitBounds(expanded, true);
    } else if (singleId) {
      // Zoom to single annotation
      const vpRect = vpRectsRef.current[singleId];
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
    }
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
    setRotation(0);

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
          evt.preventDefaultAction = true;
        });

        viewerRef.current = viewer;
        onViewerReady?.(viewer);

        viewer.addHandler('open', () => {
          setLoading(false);
          viewer.viewport.setRotation(0);
          if (lastViewportRef.current) {
            viewer.viewport.fitBounds(lastViewportRef.current, true);
            lastViewportRef.current = null;
          }
          if (annotations.length) {
            addOverlays();
            // Wait for the next frame to ensure overlays are fully rendered
            requestAnimationFrame(() => {
              setTimeout(() => {
                zoomToSelected();
              }, 100);
            });
          }
        });

        container?.addEventListener('click', (e: MouseEvent) => {
          const el = (e.target as HTMLElement).closest(
            '[data-annotation-id]',
          ) as HTMLElement;
          if (el?.dataset.annotationId) {
            e.stopPropagation();

            if (linkingModeRef.current && onSelectedIdsChangeRef.current) {
              const clickedId = el.dataset.annotationId;
              const currentSelectedIds = selectedIdsRef.current || [];

              if (currentSelectedIds.includes(clickedId)) {
                const newIds = currentSelectedIds.filter(
                  (id) => id !== clickedId,
                );
                onSelectedIdsChangeRef.current(newIds);
              } else {
                const newIds = [...currentSelectedIds, clickedId];
                onSelectedIdsChangeRef.current(newIds);
              }
            } else {
              onSelectRef.current?.(el.dataset.annotationId);
            }
          }
        });

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

        // Add viewport state change support (from main branch)
        if (onViewportStateChange) {
          viewer.addHandler('viewport-change', () => {
            const bounds = viewer.viewport.getBounds();
            const center = viewer.viewport.getCenter();
            const zoom = viewer.viewport.getZoom();
            onViewportStateChange({ center, zoom, bounds });
          });
        }
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
    showAITextspotting,
    showAIIconography,
    showHumanTextspotting,
    showHumanIconography,
    linkingMode,
    selectedIds,
    onSelectedIdsChange,
    showAnnotations,
  ]);

  // Linking mode effects
  useEffect(() => {
    linkingModeRef.current = linkingMode;
    // Auto-zoom when entering linking mode with multiple selected annotations
    if (
      linkingMode &&
      viewerRef.current &&
      selectedIdsRef.current &&
      selectedIdsRef.current.length > 1
    ) {
      // Add a small delay to ensure overlays are rendered
      setTimeout(() => {
        zoomToSelected();
      }, 150);
    }
  }, [linkingMode]);

  useEffect(() => {
    onSelectedIdsChangeRef.current = onSelectedIdsChange;
  }, [onSelectedIdsChange]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    currentPointSelectorRef.current = currentPointSelector;
  }, [currentPointSelector]);

  // Drawing active effect (from main branch)
  useEffect(() => {
    overlaysRef.current.forEach((overlay) => {
      overlay.style.pointerEvents = isDrawingActive ? 'none' : 'auto';
    });
  }, [isDrawingActive]);

  // Enhanced useEffect for annotation selection and linking management
  useEffect(() => {
    onSelectRef.current = onAnnotationSelect;
    selectedIdRef.current = selectedAnnotationId;

    if (viewMode === 'annotation' && viewerRef.current && !isDrawingActive) {
      addOverlays();
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
  ]);

  // Selection and linking effects
  useEffect(() => {
    selectedIdRef.current = selectedAnnotationId;
    if (viewerRef.current) {
      styleOverlays();
      if (!preserveViewport && selectedAnnotationId) {
        setTimeout(() => zoomToSelected(), 50);
      }
    }
  }, [selectedAnnotationId, preserveViewport]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
    if (viewerRef.current) {
      styleOverlays();
      // Auto-zoom when multiple annotations are selected in linking mode
      if (linkingModeRef.current && selectedIds && selectedIds.length > 1) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            zoomToSelected();
          }, 100);
        });
      }
    }
  }, [selectedIds]);

  useEffect(() => {
    annotationsRef.current = annotations;
    if (viewerRef.current) {
      styleOverlays();
      // If we're in linking mode with multiple selected annotations, zoom to them
      if (
        linkingModeRef.current &&
        selectedIdsRef.current &&
        selectedIdsRef.current.length > 1
      ) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            zoomToSelected();
          }, 150);
        });
      }
    }
  }, [annotations]);

  // ViewMode effect from main branch
  useEffect(() => {
    if (!viewerRef.current) return;

    if (viewMode === 'annotation' && annotations.length > 0) {
      addOverlays();
      styleOverlays();
    } else {
      viewerRef.current.clearOverlays();
      overlaysRef.current = [];
      vpRectsRef.current = {};
    }
  }, [viewMode, annotations, selectedAnnotationId]);

  useEffect(() => {
    if (viewerRef.current && viewerRef.current.viewport) {
      lastViewportRef.current = viewerRef.current.viewport.getBounds();
    }
  }, []);

  return (
    <div
      className={cn('w-full h-full relative')}
      key={`osd-canvas-${currentCanvas}`}
      style={
        linkingMode
          ? {
              cursor:
                "url(\"data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='11' fill='%23ffffff' stroke='%23336B5E' stroke-width='2'/%3E%3Cpath d='M12 6v12M6 12h12' stroke='%23336B5E' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E\") 12 12, crosshair",
            }
          : {}
      }
    >
      <div ref={mountRef} className="w-full h-full" />

      {/* Drawing Tools Integration (from main branch) */}
      {viewMode === 'annotation' &&
        !loading &&
        !noSource &&
        !errorMsg &&
        onNewAnnotation &&
        onAnnotationUpdate && (
          <DrawingTools
            viewer={viewerRef.current}
            canvasId={`canvas-${currentCanvas}`}
            isVisible={true}
            onNewAnnotation={onNewAnnotation}
            onAnnotationUpdate={onAnnotationUpdate}
            onDrawingStateChange={setIsDrawingActive}
            selectedAnnotation={annotations.find(
              (a) => a.id === selectedAnnotationId,
            )}
          />
        )}

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
