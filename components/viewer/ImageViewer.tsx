/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable no-restricted-syntax */

'use client';

import type { Annotation, LinkingAnnotation } from '@/lib/types';
import { Loader2, RotateCcw, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/shared/Button';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { DrawingTools } from '../../components/viewer/DrawingTools';
import { cn } from '../../lib/shared/utils';
import {
  getCanvasImageInfo,
  getManifestCanvases,
} from '../../lib/viewer/iiif-helpers';

const CROSSHAIR_CURSOR = `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 2v20M2 12h20' stroke='%23000000' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M12 2v20M2 12h20' stroke='%23ffffff' stroke-width='1' stroke-linecap='round'/%3E%3C/svg%3E") 8 8, crosshair`;

const normalizeCanvasId = (uri?: string) => uri?.split('#')[0]?.split('?')[0];

const extractCanvasSource = (source: unknown): string | undefined => {
  if (!source) return undefined;
  if (typeof source === 'string') return source;
  if (typeof source === 'object') {
    const specific = source as Record<string, unknown>;
    const directSource = specific.source;
    if (typeof directSource === 'string') {
      return directSource;
    }
    if (
      directSource &&
      typeof directSource === 'object' &&
      typeof (directSource as Record<string, unknown>).id === 'string'
    ) {
      return (directSource as Record<string, unknown>).id as string;
    }
    if (typeof specific.id === 'string') {
      return specific.id;
    }
  }
  return undefined;
};

interface ImageViewerProps {
  manifest: any;
  currentCanvas: number;
  annotations?: Annotation[];
  selectedAnnotationId?: string | null;
  onAnnotationSelect?: (id: string | null) => void;
  onViewerReady?: (viewer: any) => void;
  onNewAnnotation?: (annotation: Annotation) => void;
  onAnnotationUpdate?: (annotation: Annotation) => void;
  showAITextspotting: boolean;
  showAIIconography: boolean;
  showHumanTextspotting: boolean;
  showHumanIconography: boolean;
  viewMode: 'image' | 'annotation' | 'map' | 'gallery' | 'info';
  preserveViewport?: boolean;
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
  isGlobalLoading?: boolean;
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
  onPointSelect,
  isPointSelectionMode = false,
  selectedPoint = null,
  linkedAnnotationsOrder = [],
  linkingAnnotations = [],
  isLinkingMode = false,
  isGlobalLoading = false,
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

  // Refs for mode-dependent state so overlay click handlers stay current
  const isLinkingModeRef = useRef(isLinkingMode);
  isLinkingModeRef.current = isLinkingMode;
  const selectedAnnotationsForLinkingRef = useRef(
    selectedAnnotationsForLinking,
  );
  selectedAnnotationsForLinkingRef.current = selectedAnnotationsForLinking;
  const onAnnotationAddToLinkingRef = useRef(onAnnotationAddToLinking);
  onAnnotationAddToLinkingRef.current = onAnnotationAddToLinking;
  const onAnnotationRemoveFromLinkingRef = useRef(
    onAnnotationRemoveFromLinking,
  );
  onAnnotationRemoveFromLinkingRef.current = onAnnotationRemoveFromLinking;

  const [rotation, setRotation] = useState(0);
  const [isDrawingActive, setIsDrawingActive] = useState(false);

  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<string[]>([]);
  const [bulkDeleteSelectCallback, setBulkDeleteSelectCallback] = useState<
    ((id: string) => void) | null
  >(null);

  // Refs for component-state values (declared after useState)
  const bulkDeleteModeRef = useRef(bulkDeleteMode);
  bulkDeleteModeRef.current = bulkDeleteMode;
  const bulkDeleteSelectCallbackRef = useRef(bulkDeleteSelectCallback);
  bulkDeleteSelectCallbackRef.current = bulkDeleteSelectCallback;

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
      annotation.target &&
      typeof annotation.target === 'object' &&
      'generator' in annotation.target &&
      (
        annotation.target as { generator?: { id?: string } }
      ).generator?.id?.includes('segment_icons.py');

    return hasAIGenerator || hasTargetAIGenerator;
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

  const isTextAnnotation = (annotation: Annotation) => {
    if (isIconAnnotation(annotation)) {
      return false;
    }

    if (annotation.motivation === 'textspotting') {
      return true;
    }

    const bodies = getBodies(annotation);
    const hasTextualContent = bodies.some(
      (body) =>
        body.type === 'TextualBody' &&
        body.value &&
        body.value.trim().length > 0 &&
        body.purpose !== 'describing' &&
        body.purpose !== 'assessing' &&
        body.purpose !== 'commenting' &&
        !body.value.toLowerCase().includes('icon'),
    );

    return hasTextualContent;
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

  // Memoize the filtered annotation list to avoid recomputing on every render
  const visibleAnnotations = useMemo(
    () => annotations.filter(shouldShowAnnotation),
    [
      annotations,
      showAITextspotting,
      showAIIconography,
      showHumanTextspotting,
      showHumanIconography,
    ],
  );

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
  const [viewerReady, setViewerReady] = useState(0);

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
    // Need viewport and tiled image to be available for coordinate conversion
    if (
      !viewer.viewport ||
      !viewer.world ||
      viewer.world.getItemCount() === 0
    ) {
      return;
    }

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

    let skippedNoSvg = 0;
    let skippedBadPolygon = 0;
    let successfulOverlays = 0;

    for (const anno of visibleAnnotations) {
      let svgVal: string | null = null;
      const sel = anno.target?.selector;
      if (sel) {
        if (
          typeof sel === 'object' &&
          !Array.isArray(sel) &&
          'type' in sel &&
          (sel as any).type === 'SvgSelector'
        ) {
          svgVal = (sel as any).value;
        } else if (Array.isArray(sel)) {
          const f = sel.find(
            (s: any) =>
              s &&
              typeof s === 'object' &&
              'type' in s &&
              s.type === 'SvgSelector',
          );
          if (f) svgVal = (f as any).value;
        }
      }
      if (!svgVal) {
        skippedNoSvg++;
        continue;
      }

      const match = svgVal.match(/<polygon points="([^"]+)"/);
      if (!match) {
        skippedBadPolygon++;
        continue;
      }

      const coords = match[1]!
        .trim()
        .split(/\s+/)
        .map((pt) => pt.split(',').map(Number));
      const bbox = coords.reduce(
        (r, [x, y]) => ({
          minX: Math.min(r.minX, x!),
          minY: Math.min(r.minY, y!),
          maxX: Math.max(r.maxX, x!),
          maxY: Math.max(r.maxY, y!),
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

      // Base styling — selection/linking styles applied by updateOverlayStyles
      Object.assign(div.style, {
        position: 'absolute',
        pointerEvents: isDrawingActive || pointSelectionMode ? 'none' : 'auto',
        zIndex: '20',
        clipPath: `polygon(${coords
          .map(
            ([cx, cy]) => `${((cx! - x) / w) * 100}% ${((cy! - y) / h) * 100}%`,
          )
          .join(',')})`,
        cursor: 'pointer',
        backgroundColor: isHumanModified
          ? 'rgba(58,89,87,0.25)'
          : 'hsl(var(--primary) / 0.2)',
        border: isHumanModified
          ? '1px solid rgba(58,89,87,0.8)'
          : '1px solid hsl(var(--primary) / 0.6)',
      });

      const tooltipText = getTooltipText(anno);
      if (tooltipText) div.dataset.tooltipText = tooltipText;

      const creatorType = getCreatorType(anno);
      div.dataset.creatorType = creatorType;

      // Click handler uses refs so it stays current without overlay recreation
      const annoId = anno.id;
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
        if (bulkDeleteModeRef.current && bulkDeleteSelectCallbackRef.current) {
          bulkDeleteSelectCallbackRef.current(annoId);
        } else if (isLinkingModeRef.current) {
          if (selectedAnnotationsForLinkingRef.current.includes(annoId)) {
            onAnnotationRemoveFromLinkingRef.current?.(annoId);
          } else {
            onAnnotationAddToLinkingRef.current?.(annoId);
          }
        } else {
          onSelectRef.current?.(annoId);
        }
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
      successfulOverlays++;
    }

    if (selectedPoint) {
      const pointDiv = document.createElement('div');
      pointDiv.dataset.isPointOverlay = 'true';

      const pointSize = 12;
      Object.assign(pointDiv.style, {
        position: 'absolute',
        width: `${pointSize}px`,
        height: `${pointSize}px`,
        backgroundColor: '#f59e0b',
        border: '3px solid white',
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: '100',
        boxShadow:
          '0 3px 12px rgba(245, 158, 11, 0.6), 0 1px 3px rgba(0, 0, 0, 0.2)',
        transform: 'translate(-50%, -50%)',
        outline: '2px solid rgba(245, 158, 11, 0.3)',
        outlineOffset: '2px',
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

    if (linkingAnnotations.length > 0) {
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
            const pointSelectorSource = extractCanvasSource(bodyItem.source);
            const currentCanvasUri = manifest?.items?.[currentCanvas]?.id;

            if (!pointSelectorSource || !currentCanvasUri) {
              return;
            }

            if (
              normalizeCanvasId(pointSelectorSource) !==
              normalizeCanvasId(currentCanvasUri)
            ) {
              return;
            }

            const pointDiv = document.createElement('div');
            pointDiv.dataset.isLinkingPointOverlay = 'true';
            pointDiv.dataset.linkingAnnotationId = linkingAnnotation.id;

            const pointSize = 12;
            const isSelectedPoint =
              selectedPointLinkingId === linkingAnnotation.id;

            const backgroundColor = isSelectedPoint ? '#f59e0b' : '#34514a';

            const borderColor = 'white';
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
                ? '0 3px 12px rgba(245, 158, 11, 0.6), 0 1px 3px rgba(0, 0, 0, 0.2)'
                : '0 2px 8px rgba(5, 150, 105, 0.4), 0 1px 3px rgba(0, 0, 0, 0.2)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              transform: 'translate(-50%, -50%)',
              outline: isSelectedPoint
                ? '2px solid rgba(245, 158, 11, 0.3)'
                : 'none',
              outlineOffset: '2px',
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
                      const tooltipText = getTooltipText(annotation);
                      if (tooltipText) {
                        return {
                          text: tooltipText,
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
                    const targetSource = (target as any).source;
                    const annotationId =
                      targetSource.split('#')[1] || targetSource;
                    const annotation = annotations.find(
                      (anno) =>
                        anno.id === annotationId ||
                        anno.id.endsWith(annotationId),
                    );
                    if (annotation) {
                      const tooltipText = getTooltipText(annotation);
                      if (tooltipText) {
                        return {
                          text: tooltipText,
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
                      text: 'Icon',
                      type: 'icon',
                    };
                  }
                  return null;
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

    // Force OSD to run its draw cycle so drawHTML positions the overlays.
    // Required when adding overlays outside the open handler.
    viewer.forceRedraw();
  };

  // Lightweight style update — updates existing overlay DOM elements without
  // recreating them (avoids clearing 1285+ overlays on every selection or
  // linking annotation change).
  const updateOverlayStyles = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Remove existing badge overlays
    const badgeElements = overlaysRef.current.filter(
      (el) => el.dataset.badgeFor,
    );
    badgeElements.forEach((badge) => {
      try {
        viewer.removeOverlay(badge);
      } catch (_e) {
        /* ignore */
      }
    });
    overlaysRef.current = overlaysRef.current.filter(
      (el) => !el.dataset.badgeFor,
    );

    for (const div of overlaysRef.current) {
      // Skip point overlays
      if (
        div.dataset.isPointOverlay === 'true' ||
        div.dataset.isLinkingPointOverlay === 'true'
      ) {
        continue;
      }
      const annoId = div.dataset.annotationId;
      if (!annoId) {
        continue;
      }

      const isHumanModified = div.dataset.humanModified === 'true';
      const isSel = annoId === selectedAnnotationId;
      const isLinked = linkedAnnotationsOrder.includes(annoId);
      const readingOrder = linkedAnnotationsOrder.indexOf(annoId);
      const isSelectedForLinking =
        selectedAnnotationsForLinking.includes(annoId);
      const linkingOrder = selectedAnnotationsForLinking.indexOf(annoId);
      const isSelectedForDelete = selectedForDelete.includes(annoId);

      let isLinkedToSelected = false;
      let linkedAnnotationOrder = -1;

      if (selectedAnnotationId) {
        const selectedLinkingAnnotation = linkingAnnotations.find((la) =>
          la.target.includes(selectedAnnotationId),
        );
        if (selectedLinkingAnnotation) {
          const allLinkedIds = selectedLinkingAnnotation.target;
          isLinkedToSelected = allLinkedIds.includes(annoId);
          if (isLinkedToSelected) {
            linkedAnnotationOrder = allLinkedIds.indexOf(annoId);
          }
        }
      }

      let backgroundColor: string;
      let border: string;
      let cursor: string = 'pointer';

      if (isSel) {
        backgroundColor = 'rgba(255,0,0,0.3)';
        border = '2px solid rgba(255,0,0,0.8)';
      } else if (
        (isSelectedForLinking && isLinkingMode) ||
        (isLinkedToSelected && !isLinkingMode)
      ) {
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

      if (bulkDeleteMode) {
        cursor = 'pointer';
        if (isSelectedForDelete) {
          backgroundColor = 'hsl(var(--destructive) / 0.5)';
          border = '3px solid hsl(var(--destructive) / 0.9)';
        } else {
          backgroundColor = backgroundColor.replace(/0\.\d+/, '0.1');
          border = '1px solid hsl(var(--muted-foreground) / 0.3)';
        }
      } else if (isLinkingMode) {
        cursor = 'copy';
      }

      div.style.backgroundColor = backgroundColor;
      div.style.border = border;
      div.style.cursor = cursor;

      // Add order badges where needed
      let badgeNumber = -1;
      let badgeColor = '';

      if (isSelectedForLinking && isLinkingMode && linkingOrder >= 0) {
        badgeNumber = linkingOrder + 1;
        badgeColor = 'rgba(58,89,87,0.9)';
      } else if (
        isLinkedToSelected &&
        !isLinkingMode &&
        linkedAnnotationOrder >= 0
      ) {
        badgeNumber = linkedAnnotationOrder + 1;
        badgeColor = 'rgba(212,165,72,0.9)';
      } else if (isLinked && readingOrder >= 0) {
        badgeNumber = readingOrder + 1;
        badgeColor = 'rgba(212,165,72,0.9)';
      }

      if (badgeNumber >= 0) {
        const vpRect = vpRectsRef.current[annoId];
        if (vpRect) {
          const badgeContainer = document.createElement('div');
          badgeContainer.dataset.badgeFor = annoId;
          Object.assign(badgeContainer.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: '25',
          });
          const orderBadge = document.createElement('div');
          orderBadge.textContent = badgeNumber.toString();
          Object.assign(orderBadge.style, {
            position: 'absolute',
            top: '-12px',
            left: '-12px',
            backgroundColor: badgeColor,
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
          viewer.addOverlay({ element: badgeContainer, location: vpRect });
          overlaysRef.current.push(badgeContainer);
        }
      }
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

    const rect = osd.Rect;

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

    const expanded = new rect(
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

    // Guard against React StrictMode double-init: the async import means
    // the cleanup can run before the viewer is created, leaving an orphaned
    // OSD container in the DOM. This flag lets us bail out after the await.
    let cancelled = false;

    setLoading(true);
    setNoSource(false);
    setErrorMsg(null);
    setRotation(0);
    setViewerReady(0);

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

        // StrictMode guard: if cleanup ran while we were awaiting the
        // dynamic import, abandon viewer creation to prevent a duplicate.
        if (cancelled) return;

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
            if (viewer.canvas !== null) {
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

          // Deselect annotation when clicking on empty canvas space
          // (annotation overlay clicks are stopped from propagating)
          onSelectRef.current?.(null);

          evt.preventDefaultAction = true;
        });

        viewerRef.current = viewer;
        (window as any).osdViewer = viewer;
        onViewerReady?.(viewer);

        // Suppress tile load abort errors - these are expected during canvas switching
        viewer.addHandler('tile-load-failed', (event: any) => {
          // Only log actual errors, not aborts (expected during navigation)
          if (event.message && !event.message.includes('aborted')) {
            console.warn('Tile load failed:', event.message);
          }
        });

        viewer.addHandler('open', () => {
          setLoading(false);
          viewer.viewport.setRotation(0);
          if (lastViewportRef.current) {
            viewer.viewport.fitBounds(lastViewportRef.current, true);
            lastViewportRef.current = null;
          }
          setViewerReady((prev) => prev + 1);
        });

        container?.addEventListener('click', (e: MouseEvent) => {
          const el = (e.target as HTMLElement).closest(
            '[data-annotation-id]',
          ) as HTMLElement | null;
          if (el && el.dataset.annotationId) {
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
          if (r.right > window.innerWidth) {
            tt.style.left = `${e.pageX - r.width - offset}px`;
          }
          if (r.bottom > window.innerHeight) {
            tt.style.top = `${e.pageY - r.height - offset}px`;
          }
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

    initViewer().catch(() => {});

    return () => {
      cancelled = true;

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
          // Preserve viewport across viewer recreation
          if (viewerRef.current.viewport) {
            lastViewportRef.current =
              viewerRef.current.viewport.getBounds(true);
          }
          viewerRef.current.clearOverlays();
          viewerRef.current.destroy();
        } catch (e) {}
        viewerRef.current = null;
        (window as any).osdViewer = null;
      }
      overlaysRef.current = [];
      vpRectsRef.current = {};

      // Remove any orphaned OSD containers left by StrictMode double-init
      if (container) {
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      }

      const unifiedTooltips = document.querySelectorAll(
        '.unified-annotation-tooltip',
      );
      unifiedTooltips.forEach((tooltip) => {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      });
    };
  }, [manifest, currentCanvas]);

  // Update pointer events when drawing mode changes
  useEffect(() => {
    overlaysRef.current.forEach((overlay) => {
      overlay.style.pointerEvents = isDrawingActive ? 'none' : 'auto';
    });
  }, [isDrawingActive]);

  useEffect(() => {
    onSelectRef.current = onAnnotationSelect;
    selectedIdRef.current = selectedAnnotationId;
  }, [onAnnotationSelect, selectedAnnotationId]);

  // Zoom to selected annotation when selection changes
  useEffect(() => {
    if (!viewerRef.current || !selectedAnnotationId) return;

    if (annotations.length > 0 && !vpRectsRef.current[selectedAnnotationId]) {
      addOverlays(viewerRef.current, isPointSelectionMode);
    }

    if (!preserveViewport) {
      setTimeout(() => zoomToSelected(), 50);
    }
  }, [selectedAnnotationId, preserveViewport]);

  // Overlay CREATION — fires when view mode, filters, annotations, or drawing
  // state change. Also handles overlay recreation after viewer open.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewerReady) return;
    if (!viewer.viewport || !viewer.world || viewer.world.getItemCount() === 0)
      return;

    if (
      viewMode === 'annotation' &&
      !isDrawingActive &&
      visibleAnnotations.length > 0
    ) {
      addOverlays(viewer, isPointSelectionMode);
      updateOverlayStyles();
    } else {
      viewer.clearOverlays();
      overlaysRef.current = [];
      vpRectsRef.current = {};
    }
  }, [
    viewMode,
    viewerReady,
    visibleAnnotations,
    isDrawingActive,
    selectedPoint,
    isPointSelectionMode,
  ]);

  // Overlay STYLING — lightweight update that runs whenever selection,
  // linking, or bulk-delete state changes. Updates CSS on existing overlay
  // elements and manages order badges without recreating all 1200+ overlays.
  useEffect(() => {
    if (!viewerRef.current || overlaysRef.current.length === 0) return;
    if (viewMode !== 'annotation') return;
    updateOverlayStyles();
  }, [
    selectedAnnotationId,
    linkingAnnotations,
    selectedAnnotationsForLinking,
    linkedAnnotationsOrder,
    isLinkingMode,
    bulkDeleteMode,
    selectedForDelete,
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
