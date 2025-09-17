'use client';

import { Button } from '@/components/shared/Button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { DrawingTools } from '@/components/viewer/DrawingTools';
import { cn } from '@/lib/shared/utils';
import type { Annotation, LinkingAnnotation } from '@/lib/types';
import {
  getCanvasImageInfo,
  getManifestCanvases,
} from '@/lib/viewer/iiif-helpers';
import { RotateCcw, RotateCw } from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const CROSSHAIR_CURSOR = `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 2v20M2 12h20' stroke='%23000000' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M12 2v20M2 12h20' stroke='%23ffffff' stroke-width='1' stroke-linecap='round'/%3E%3C/svg%3E") 8 8, crosshair`;

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
  selectedPointLinkingId?: string | null;
  onPointClick?: (linkingAnnotationId: string) => void;
  onRefreshAnnotations?: () => void;
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
  selectedPointLinkingId = null,
  onPointClick,
  onRefreshAnnotations,
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

  // Bulk delete mode state
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<string[]>([]);
  const [bulkDeleteSelectCallback, setBulkDeleteSelectCallback] = useState<
    ((id: string) => void) | null
  >(null);

  // Handle bulk delete mode changes from DrawingTools
  const handleBulkDeleteModeChange = useCallback(
    (
      isActive: boolean,
      selectedIds: string[],
      selectCallback: (id: string) => void,
    ) => {
      setBulkDeleteMode(isActive);
      setSelectedForDelete(selectedIds);
      setBulkDeleteSelectCallback(() => selectCallback);
    },
    [],
  );

  const isAIGenerated = (annotation: Annotation) => {
    if (isHumanCreated(annotation)) {
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
    if (annotation.creator) {
      return true;
    }

    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : [annotation.body];
    const textualBodies = bodies.filter((b) => b?.type === 'TextualBody');
    return textualBodies.some((body) => body.creator && !body.generator);
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

    const humanBody = bodies.find(
      (body) => !body.generator && body.value && body.value.trim().length > 0,
    );

    if (humanBody) {
      return humanBody.value;
    }

    const aiBody = bodies.find(
      (body) => body.generator && body.value && body.value.trim().length > 0,
    );

    return aiBody?.value || '';
  };

  const getTooltipText = (annotation: Annotation) => {
    if (isIconAnnotation(annotation)) {
      return 'Icon';
    }

    const bodies = getBodies(annotation);

    const humanBody = bodies.find(
      (body) => !body.generator && body.value && body.value.trim().length > 0,
    );

    if (humanBody) {
      return humanBody.value;
    }

    const loghiBody = bodies.find(
      (body) =>
        body.generator &&
        (body.generator.label?.toLowerCase().includes('loghi') ||
          body.generator.id?.includes('loghi')) &&
        body.value &&
        body.value.trim().length > 0,
    );

    if (loghiBody) {
      return loghiBody.value;
    }

    const otherAiBody = bodies.find(
      (body) =>
        body.generator &&
        !(
          body.generator.label?.toLowerCase().includes('loghi') ||
          body.generator.id?.includes('loghi')
        ) &&
        body.value &&
        body.value.trim().length > 0,
    );

    return otherAiBody?.value || '';
  };

  const getCreatorType = (annotation: Annotation) => {
    return isHumanCreated(annotation) ? 'Human' : 'AI';
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

  const createTooltip = (content: string, isHTML: boolean = false) => {
    const tooltip = document.createElement('div');
    tooltip.className = 'unified-annotation-tooltip';
    tooltip.style.cssText = `
      position: absolute;
      background: hsl(var(--card));
      color: hsl(var(--card-foreground));
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      border: 1px solid hsl(var(--border));
      z-index: 9999;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
      max-width: 200px;
      word-wrap: break-word;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    if (isHTML) {
      tooltip.innerHTML = content;
    } else {
      tooltip.textContent = content;
    }

    document.body.appendChild(tooltip);
    return tooltip;
  };

  const addOverlays = (viewer: any, pointSelectionMode: boolean = false) => {
    const existingTooltips = document.querySelectorAll(
      '.unified-annotation-tooltip',
    );
    existingTooltips.forEach((tooltip) => {
      if (tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip);
      }
    });

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

      const isHumanModified = isHumanCreated(anno);
      div.dataset.humanModified = isHumanModified ? 'true' : 'false';

      const isSel = anno.id === selectedAnnotationId;
      const isLinked = linkedAnnotationsOrder.includes(anno.id);
      const readingOrder = linkedAnnotationsOrder.indexOf(anno.id);
      const isSelectedForLinking = selectedAnnotationsForLinking.includes(
        anno.id,
      );
      const linkingOrder = selectedAnnotationsForLinking.indexOf(anno.id);
      const isSelectedForDelete = selectedForDelete.includes(anno.id);

      let isLinkedToSelected = false;
      let linkedAnnotationOrder = -1;
      let allLinkedIds: string[] = [];

      if (selectedAnnotationId && linkingAnnotations) {
        const selectedLinkingAnnotation = linkingAnnotations.find((la) =>
          la.target.includes(selectedAnnotationId),
        );

        if (selectedLinkingAnnotation) {
          allLinkedIds = selectedLinkingAnnotation.target;
          isLinkedToSelected = allLinkedIds.includes(anno.id);
          linkedAnnotationOrder = allLinkedIds.indexOf(anno.id);

          if (isLinkedToSelected && anno.id !== selectedAnnotationId) {
          }
        }
      }

      let backgroundColor: string;
      let border: string;
      let cursor: string = 'pointer';

      if (isSel) {
        backgroundColor = 'rgba(255,0,0,0.3)';
        border = '2px solid rgba(255,0,0,0.8)';
      } else if (isSelectedForLinking && isLinkingMode) {
        backgroundColor = 'rgba(212,165,72,0.3)';
        border = '2px solid rgba(212,165,72,0.8)';
      } else if (isLinkedToSelected && !isLinkingMode) {
        backgroundColor = 'rgba(212,165,72,0.3)';
        border = '2px solid rgba(212,165,72,0.8)';
      } else if (isLinked) {
        backgroundColor = 'rgba(255,165,0,0.3)';
        border = '2px solid rgba(255,165,0,0.8)';
      } else if (isHumanModified) {
        backgroundColor = 'rgba(58,89,87,0.25)';
        border = '1px solid rgba(58,89,87,0.8)';
      } else {
        backgroundColor = 'hsl(var(--primary) / 0.2)';
        border = '1px solid hsl(var(--primary) / 0.6)';
      }

      // Bulk delete mode styling
      if (bulkDeleteMode) {
        cursor = 'pointer';
        if (isSelectedForDelete) {
          // Selected for deletion - bright destructive red
          backgroundColor = 'hsl(var(--destructive) / 0.5)';
          border = '3px solid hsl(var(--destructive) / 0.9)';
        } else {
          // Not selected - muted appearance with subtle indication
          backgroundColor = backgroundColor.replace(/0\.\d+/, '0.1');
          border = '1px solid hsl(var(--muted-foreground) / 0.3)';
        }
      } else if (isLinkingMode) {
        cursor = 'copy';
      }

      Object.assign(div.style, {
        position: 'absolute',
        pointerEvents: isDrawingActive || pointSelectionMode ? 'none' : 'auto',
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

      const badgeContainer = document.createElement('div');
      Object.assign(badgeContainer.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: '25',
      });

      if (isSelectedForLinking && isLinkingMode && linkingOrder >= 0) {
        const orderBadge = document.createElement('div');
        orderBadge.textContent = (linkingOrder + 1).toString();
        Object.assign(orderBadge.style, {
          position: 'absolute',
          top: '-12px',
          left: '-12px',
          backgroundColor: 'rgba(58,89,87,0.9)',
          color: 'white',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'bold',
          zIndex: '30',
          pointerEvents: 'none',
          border: '2px solid white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        });
        badgeContainer.appendChild(orderBadge);
      } else if (isLinked && readingOrder >= 0) {
        const orderBadge = document.createElement('div');
        orderBadge.textContent = (readingOrder + 1).toString();
        Object.assign(orderBadge.style, {
          position: 'absolute',
          top: '-12px',
          left: '-12px',
          backgroundColor: 'rgba(212,165,72,0.9)',
          color: 'white',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'bold',
          zIndex: '30',
          pointerEvents: 'none',
          border: '2px solid white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        });
        badgeContainer.appendChild(orderBadge);
      } else if (
        isLinkedToSelected &&
        !isLinkingMode &&
        linkedAnnotationOrder >= 0
      ) {
        const orderBadge = document.createElement('div');
        orderBadge.textContent = (linkedAnnotationOrder + 1).toString();
        Object.assign(orderBadge.style, {
          position: 'absolute',
          top: '-12px',
          left: '-12px',
          backgroundColor: 'rgba(58,89,87,0.9)',
          color: 'white',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'bold',
          zIndex: '30',
          pointerEvents: 'none',
          border: '2px solid white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        });
        badgeContainer.appendChild(orderBadge);
      }

      const tooltipText = getTooltipText(anno);
      if (tooltipText) div.dataset.tooltipText = tooltipText;

      const creatorType = getCreatorType(anno);
      div.dataset.creatorType = creatorType;

      const handleAnnotationClick = () => {
        if (bulkDeleteMode && bulkDeleteSelectCallback) {
          // In bulk delete mode, select/deselect for deletion
          bulkDeleteSelectCallback(anno.id);
        } else if (isLinkingMode) {
          if (isSelectedForLinking) {
            onAnnotationRemoveFromLinking?.(anno.id);
          } else {
            onAnnotationAddToLinking?.(anno.id);
          }
        } else {
          onSelectRef.current?.(anno.id);
        }
      };

      let svgTooltip: HTMLElement | null = null;
      let tooltipTimeout: NodeJS.Timeout | null = null;

      const cleanupTooltip = () => {
        if (tooltipTimeout) {
          clearTimeout(tooltipTimeout);
          tooltipTimeout = null;
        }
        if (svgTooltip) {
          if (svgTooltip.parentNode) {
            svgTooltip.parentNode.removeChild(svgTooltip);
          }
          svgTooltip = null;
        }
      };

      div.addEventListener('pointerdown', (e) => e.stopPropagation());
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        cleanupTooltip();
        handleAnnotationClick();
      });
      div.addEventListener('mouseenter', (e) => {
        if (div.dataset.tooltipText) {
          cleanupTooltip();

          const tooltipContent = `
            <div style="color: hsl(var(--card-foreground)); line-height: 1.4;">
              ${div.dataset.tooltipText}
            </div>
          `;

          svgTooltip = createTooltip(tooltipContent, true);
          svgTooltip.style.left = `${e.pageX + 10}px`;
          svgTooltip.style.top = `${e.pageY + 10}px`;

          const tooltipRect = svgTooltip.getBoundingClientRect();
          if (tooltipRect.right > window.innerWidth - 10) {
            svgTooltip.style.left = `${e.pageX - tooltipRect.width - 10}px`;
          }
          if (tooltipRect.bottom > window.innerHeight - 10) {
            svgTooltip.style.top = `${e.pageY - tooltipRect.height - 10}px`;
          }
          svgTooltip.style.opacity = '1';
        }
      });
      div.addEventListener('mousemove', (e) => {
        if (svgTooltip) {
          svgTooltip.style.left = `${e.pageX + 10}px`;
          svgTooltip.style.top = `${e.pageY + 10}px`;

          const tooltipRect = svgTooltip.getBoundingClientRect();
          if (tooltipRect.right > window.innerWidth - 10) {
            svgTooltip.style.left = `${e.pageX - tooltipRect.width - 10}px`;
          }
          if (tooltipRect.bottom > window.innerHeight - 10) {
            svgTooltip.style.top = `${e.pageY - tooltipRect.height - 10}px`;
          }
        }
      });
      div.addEventListener('mouseleave', () => {
        cleanupTooltip();
      });

      viewer.addOverlay({ element: div, location: vpRect });
      overlaysRef.current.push(div);

      if (badgeContainer.children.length > 0) {
        viewer.addOverlay({ element: badgeContainer, location: vpRect });
        overlaysRef.current.push(badgeContainer);
      }
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
        return;
      }

      const viewportPoint = viewer.viewport.imageToViewportCoordinates(
        new osdRef.current!.Point(selectedPoint.x, selectedPoint.y),
      );

      viewer.addOverlay({
        element: pointDiv,
        location: viewportPoint,
      });
      overlaysRef.current.push(pointDiv);
    }

    if (linkingAnnotations && linkingAnnotations.length > 0) {
      linkingAnnotations.forEach((linkingAnnotation, index) => {
        const body = Array.isArray(linkingAnnotation.body)
          ? linkingAnnotation.body
          : [linkingAnnotation.body];

        body.forEach((bodyItem, bodyIndex) => {
          if (
            bodyItem.purpose === 'selecting' &&
            bodyItem.selector &&
            bodyItem.selector.type === 'PointSelector' &&
            typeof bodyItem.selector.x === 'number' &&
            typeof bodyItem.selector.y === 'number'
          ) {
            // Show ALL linking annotation points on every canvas for visibility
            // This allows users to see all linked points regardless of which canvas they're viewing
            const pointSelectorSource =
              typeof bodyItem.source === 'string'
                ? bodyItem.source
                : bodyItem.source?.id || bodyItem.source;
            const currentCanvasUri = manifest?.items?.[currentCanvas]?.id;

            const pointDiv = document.createElement('div');
            pointDiv.dataset.isLinkingPointOverlay = 'true';
            pointDiv.dataset.linkingAnnotationId = linkingAnnotation.id;

            const pointSize = 10;
            const isSelectedPoint =
              selectedPointLinkingId === linkingAnnotation.id;

            const backgroundColor = isSelectedPoint
              ? 'hsl(45 64% 59% / 0.9)'
              : 'hsl(165 22% 26% / 0.9)';

            const borderColor = isSelectedPoint ? '#d4a548' : 'white';
            const borderWidth = isSelectedPoint ? '3px' : '2px';

            Object.assign(pointDiv.style, {
              position: 'absolute',
              width: `${pointSize}px`,
              height: `${pointSize}px`,
              backgroundColor,
              border: `${borderWidth} solid ${borderColor}`,
              borderRadius: '50%',
              pointerEvents: 'auto',
              zIndex: isSelectedPoint ? '101' : '99',
              boxShadow: isSelectedPoint
                ? '0 2px 8px rgba(212,165,72,0.5)'
                : '0 2px 4px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              transition: 'all 0.1s ease',
            });

            if (!viewer.world || viewer.world.getItemCount() === 0) {
              return;
            }

            const viewportPoint = viewer.viewport.imageToViewportCoordinates(
              new osdRef.current!.Point(
                bodyItem.selector.x,
                bodyItem.selector.y,
              ),
            );

            let tooltip: HTMLElement | null = null;
            let tooltipTimeout: NodeJS.Timeout | null = null;

            const cleanupPointTooltip = () => {
              if (tooltipTimeout) {
                clearTimeout(tooltipTimeout);
                tooltipTimeout = null;
              }
              if (tooltip) {
                if (tooltip.parentNode) {
                  tooltip.parentNode.removeChild(tooltip);
                }
                tooltip = null;
              }
            };

            pointDiv.addEventListener('mouseenter', (e) => {
              cleanupPointTooltip();

              const targets = Array.isArray(linkingAnnotation.target)
                ? linkingAnnotation.target
                : [linkingAnnotation.target];

              const connectedLabels = targets
                .map((target) => {
                  if (typeof target === 'string') {
                    const annotation = annotations.find(
                      (anno) => anno.id === target,
                    );
                    if (annotation) {
                      const textValue = getAnnotationText(annotation);
                      if (textValue) {
                        return {
                          text:
                            textValue.substring(0, 30) +
                            (textValue.length > 30 ? '...' : ''),
                          type:
                            annotation.motivation === 'iconography' ||
                            annotation.motivation === 'iconograpy'
                              ? 'icon'
                              : 'text',
                        };
                      }
                    }
                  } else if (
                    target &&
                    typeof target === 'object' &&
                    'source' in target
                  ) {
                    const annotationId =
                      (target as any).source.split('#')[1] ||
                      (target as any).source;
                    const annotation = annotations.find(
                      (anno) =>
                        anno.id === annotationId ||
                        anno.id.endsWith(annotationId),
                    );
                    if (annotation) {
                      const textValue = getAnnotationText(annotation);
                      if (textValue) {
                        return {
                          text:
                            textValue.substring(0, 30) +
                            (textValue.length > 30 ? '...' : ''),
                          type:
                            annotation.motivation === 'iconography' ||
                            annotation.motivation === 'iconograpy'
                              ? 'icon'
                              : 'text',
                        };
                      }
                    }
                  }
                  const annotation = annotations.find(
                    (anno) => anno.id === target,
                  );
                  if (
                    annotation &&
                    (annotation.motivation === 'iconography' ||
                      annotation.motivation === 'iconograpy')
                  ) {
                    return {
                      text: 'icon',
                      type: 'icon',
                    };
                  }
                  return { text: 'text', type: 'text' };
                })
                .filter(Boolean);

              const targetCount = targets.length;
              let tooltipContent: string;

              if (connectedLabels.length > 0) {
                const labelTexts = connectedLabels.map(
                  (label: any) => label.text,
                );
                tooltipContent = `
                  <div style="color: hsl(var(--card-foreground)); line-height: 1.4;">
                    ${labelTexts.join(' + ')}
                  </div>
                `;
              } else {
                tooltipContent = `
                  <div style="color: hsl(var(--card-foreground)); line-height: 1.4;">
                    ${targetCount} connection${targetCount !== 1 ? 's' : ''}
                  </div>
                `;
              }

              tooltip = createTooltip(tooltipContent, true);
              const rect = pointDiv.getBoundingClientRect();
              tooltip.style.left = `${rect.left + rect.width / 2}px`;
              tooltip.style.top = `${rect.top - 10}px`;
              tooltip.style.transform = 'translate(-50%, -100%)';

              const tooltipRect = tooltip.getBoundingClientRect();
              if (tooltipRect.left < 10) {
                tooltip.style.left = '10px';
                tooltip.style.transform = 'translateY(-100%)';
              } else if (tooltipRect.right > window.innerWidth - 10) {
                tooltip.style.left = `${window.innerWidth - 10}px`;
                tooltip.style.transform = 'translate(-100%, -100%)';
              }
              tooltip.style.opacity = '1';
            });

            pointDiv.addEventListener('click', (e) => {
              e.stopPropagation();
              cleanupPointTooltip();
              if (onPointClick) {
                onPointClick(linkingAnnotation.id);
              }
            });

            pointDiv.addEventListener('mouseleave', () => {
              cleanupPointTooltip();
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
      addOverlays(viewer, isPointSelectionMode);
    }

    const vpRect = vpRectsRef.current[id];
    if (!vpRect) {
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
      background: 'hsl(var(--card))',
      color: 'hsl(var(--card-foreground))',
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '12px',
      boxShadow:
        '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      border: '1px solid hsl(var(--border))',
      zIndex: '9999',
      pointerEvents: 'none',
      maxWidth: '200px',
      wordWrap: 'break-word',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      transition: 'opacity 0.2s ease-in-out',
    });
    document.body.appendChild(tip);
    tooltipRef.current = tip;

    const preloader = document.createElement('div');
    preloader.style.cursor = CROSSHAIR_CURSOR;
    preloader.style.position = 'absolute';
    preloader.style.left = '-9999px';
    preloader.style.top = '-9999px';
    preloader.style.width = '1px';
    preloader.style.height = '1px';
    document.body.appendChild(preloader);

    return () => {
      if (preloader.parentNode) {
        preloader.parentNode.removeChild(preloader);
      }
    };
  }, []);

  useEffect(() => {
    isPointSelectionModeRef.current = isPointSelectionMode;
    onPointSelectRef.current = onPointSelect;

    const viewer = viewerRef.current;
    if (viewer?.canvas) {
      if (isPointSelectionMode) {
        viewer.canvas.style.cursor = CROSSHAIR_CURSOR;
      } else {
        viewer.canvas.style.cursor = '';
      }
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
        viewerRef.current.clearOverlays();

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

          if (currentIsPointSelectionMode && currentOnPointSelect) {
            if (viewer.canvas) {
              viewer.canvas.style.cursor = '';
            }

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
            addOverlays(viewer, isPointSelectionMode);
            overlaysRef.current.forEach((d) => {
              const isSel = d.dataset.annotationId === selectedAnnotationId;
              const isHumanModified = d.dataset.humanModified === 'true';

              if (isSel) {
                d.style.backgroundColor = 'rgba(255,0,0,0.3)';
                d.style.border = '2px solid rgba(255,0,0,0.8)';
              } else if (isHumanModified) {
                d.style.backgroundColor = 'rgba(58,89,87,0.25)';
                d.style.border = '1px solid rgba(58,89,87,0.8)';
              } else {
                d.style.backgroundColor = 'hsl(var(--primary) / 0.2)';
                d.style.border = '1px solid hsl(var(--primary) / 0.6)';
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
      const allTooltips = document.querySelectorAll(
        '.unified-annotation-tooltip',
      );
      allTooltips.forEach((tooltip) => {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      });

      if (viewerRef.current) {
        try {
          viewerRef.current.clearOverlays();

          viewerRef.current.destroy();
        } catch (e) {}
        viewerRef.current = null;
        (window as any).osdViewer = null;
      }
      overlaysRef.current = [];
      vpRectsRef.current = {};

      const unifiedTooltips = document.querySelectorAll(
        '.unified-annotation-tooltip',
      );
      unifiedTooltips.forEach((tooltip) => {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      });
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
        addOverlays(viewerRef.current, isPointSelectionMode);
      }
    }

    overlaysRef.current.forEach((d) => {
      const isSel = d.dataset.annotationId === selectedAnnotationId;
      const isHumanModified = d.dataset.humanModified === 'true';

      if (isSel) {
        d.style.backgroundColor = 'rgba(58,89,87,0.3)';
        d.style.border = '2px solid rgba(58,89,87,0.8)';
      } else if (isHumanModified) {
        d.style.backgroundColor = 'rgba(58,89,87,0.25)';
        d.style.border = '1px solid rgba(58,89,87,0.8)';
      } else {
        d.style.backgroundColor = 'hsl(var(--primary) / 0.2)';
        d.style.border = '1px solid hsl(var(--primary) / 0.6)';
      }
    });

    if (!preserveViewport && selectedAnnotationId) {
      setTimeout(() => zoomToSelected(), 50);
    }
  }, [selectedAnnotationId, annotations, preserveViewport]);

  useEffect(() => {
    if (!viewerRef.current) return;

    if (viewMode === 'annotation' && annotations.length > 0) {
      addOverlays(viewerRef.current, isPointSelectionMode);
      overlaysRef.current.forEach((d) => {
        const isSel = d.dataset.annotationId === selectedAnnotationId;
        const isHumanModified = d.dataset.humanModified === 'true';

        if (isSel) {
          d.style.backgroundColor = 'rgba(58,89,87,0.3)';
          d.style.border = '2px solid rgba(58,89,87,0.8)';
        } else if (isHumanModified) {
          d.style.backgroundColor = 'rgba(58,89,87,0.25)';
          d.style.border = '1px solid rgba(58,89,87,0.8)';
        } else {
          d.style.backgroundColor = 'hsl(var(--primary) / 0.2)';
          d.style.border = '1px solid hsl(var(--primary) / 0.6)';
        }
      });
    } else {
      viewerRef.current.clearOverlays();
      overlaysRef.current = [];
      vpRectsRef.current = {};
    }
  }, [
    viewMode,
    annotations,
    selectedAnnotationId,
    linkingAnnotations,
    isPointSelectionMode,
    bulkDeleteMode,
    selectedForDelete,
  ]);

  useEffect(() => {
    overlaysRef.current.forEach((overlay) => {
      overlay.style.pointerEvents = isDrawingActive ? 'none' : 'auto';
    });
  }, [isDrawingActive]);

  useEffect(() => {
    if (viewerRef.current && viewMode === 'annotation') {
      addOverlays(viewerRef.current, isPointSelectionMode);
    }
  }, [
    viewMode,
    annotations,
    selectedAnnotationId,
    linkingAnnotations,
    selectedAnnotationsForLinking,
    linkedAnnotationsOrder,
    isLinkingMode,
    selectedPoint,
    isPointSelectionMode,
    showAITextspotting,
    showAIIconography,
    showHumanTextspotting,
    showHumanIconography,
    bulkDeleteMode,
    selectedForDelete,
  ]);

  useEffect(() => {
    onSelectRef.current = onAnnotationSelect;
    selectedIdRef.current = selectedAnnotationId;
  }, [onAnnotationSelect, selectedAnnotationId]);

  useEffect(() => {
    if (!viewerRef.current) return;

    if (viewMode === 'annotation' && !isDrawingActive) {
      addOverlays(viewerRef.current, isPointSelectionMode);
    } else if (isDrawingActive) {
      viewerRef.current.clearOverlays();
      overlaysRef.current = [];
      vpRectsRef.current = {};
    }
  }, [viewMode, isDrawingActive, isPointSelectionMode]);

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
        onBulkDeleteModeChange={handleBulkDeleteModeChange}
        onRefreshAnnotations={onRefreshAnnotations}
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
