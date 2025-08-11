'use client';

import { Button } from '@/components/shared/Button';
import { Plus, Target, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

const CROSSHAIR_CURSOR = `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 2v20M2 12h20' stroke='%23587158' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M12 2v20M2 12h20' stroke='%23ffffff' stroke-width='1' stroke-linecap='round'/%3E%3C/svg%3E") 8 8, crosshair`;

interface PointSelectorProps {
  value?: { x: number; y: number } | null;
  onChange: (point: { x: number; y: number } | null) => void;
  canvasId?: string;
  manifestId?: string;
  disabled?: boolean;
  expandedStyle?: boolean;
  existingAnnotations?: any[];
  currentAnnotationId?: string;
  onStartSelecting?: () => void;
  keepExpanded?: () => void;
}

export function PointSelector({
  value,
  onChange,
  canvasId,
  manifestId,
  disabled = false,
  expandedStyle = false,
  existingAnnotations = [],
  currentAnnotationId,
  onStartSelecting,
  keepExpanded,
}: PointSelectorProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<{
    x: number;
    y: number;
  } | null>(value || null);
  const eventHandlers = useRef<Map<string, Function>>(new Map());

  const isViewerReady = () => {
    try {
      return (
        typeof window !== 'undefined' &&
        (window as any).osdViewer &&
        (window as any).osdViewer.world &&
        (window as any).osdViewer.world.getItemCount() > 0 &&
        (window as any).osdViewer.element &&
        (window as any).osdViewer.viewport
      );
    } catch (error) {
      return false;
    }
  };

  const getAnnotationText = (annotation: any) => {
    if (!annotation?.body) return '';

    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : [annotation.body];
    const textualBodies = bodies.filter((b: any) => b?.type === 'TextualBody');

    const humanBody = textualBodies.find(
      (body: any) =>
        !body.generator && body.value && body.value.trim().length > 0,
    );

    if (humanBody) {
      return humanBody.value;
    }

    const loghiBody = textualBodies.find(
      (body: any) =>
        body.generator &&
        (body.generator?.label?.toLowerCase().includes('loghi') ||
          body.generator?.id?.includes('loghi')) &&
        body.value &&
        body.value.trim().length > 0,
    );

    if (loghiBody) {
      return loghiBody.value;
    }

    const otherAiBody = textualBodies.find(
      (body: any) =>
        body.generator &&
        !(
          body.generator?.label?.toLowerCase().includes('loghi') ||
          body.generator?.id?.includes('loghi')
        ) &&
        body.value &&
        body.value.trim().length > 0,
    );

    return otherAiBody?.value || '';
  };

  const isHumanCreated = (annotation: any) => {
    if (annotation.creator) {
      return true;
    }

    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : [annotation.body];
    const textualBodies = bodies.filter((b: any) => b?.type === 'TextualBody');
    return textualBodies.some((body: any) => body.creator && !body.generator);
  };

  const getCreatorType = (annotation: any) => {
    return isHumanCreated(annotation) ? 'Human' : 'AI';
  };

  const getExistingPointSelectors = () => {
    const points: Array<{ x: number; y: number; annotationId: string }> = [];
    existingAnnotations.forEach((annotation) => {
      if (
        annotation.motivation === 'linking' &&
        annotation.body &&
        Array.isArray(annotation.body)
      ) {
        const pointSelectorBody = annotation.body.find(
          (b: any) =>
            b.type === 'SpecificResource' &&
            b.purpose === 'selecting' &&
            b.selector &&
            b.selector.type === 'PointSelector',
        );
        if (pointSelectorBody && pointSelectorBody.selector) {
          const selector = pointSelectorBody.selector;
          if (selector.x !== undefined && selector.y !== undefined) {
            points.push({
              x: selector.x,
              y: selector.y,
              annotationId: annotation.id,
            });
          }
        }
      }
    });
    return points;
  };

  const addPointIndicator = (
    x: number,
    y: number,
    viewer: any,
    type: 'current' | 'existing' = 'current',
    annotationId?: string,
  ) => {
    try {
      const indicatorId =
        type === 'current'
          ? 'point-selector-indicator'
          : `point-selector-indicator-${annotationId}`;
      const existingIndicator = document.getElementById(indicatorId);
      if (existingIndicator) {
        existingIndicator.remove();
      }
      if (!viewer || !viewer.world || viewer.world.getItemCount() === 0) {
        return;
      }
      const imageSize = viewer.world.getItemAt(0).getContentSize();
      const imageBounds = viewer.world.getItemAt(0).getBounds();
      const imageX = (x / imageSize.x) * imageBounds.width;
      const imageY = (y / imageSize.y) * imageBounds.height;
      const viewportPoint = viewer.viewport.imageToViewportCoordinates(
        imageX,
        imageY,
      );
      const indicator = document.createElement('div');
      indicator.id = indicatorId;
      const backgroundColor =
        type === 'current' ? 'hsl(var(--secondary))' : 'hsl(var(--primary))';
      const size = type === 'current' ? '12px' : '8px';
      const zIndex = type === 'current' ? '11' : '10';
      const pointerEvents = type === 'existing' ? 'auto' : 'none';

      indicator.style.cssText = `
      position: absolute;
      width: ${size};
      height: ${size};
      background: ${backgroundColor};
      border: 2px solid white;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: ${pointerEvents};
      z-index: ${zIndex};
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      cursor: help;
      ${type === 'existing' ? 'opacity: 0.8;' : ''}
    `;

      if (type === 'existing' && annotationId) {
        const linkedAnnotation = existingAnnotations.find(
          (ann) => ann.id === annotationId,
        );
        if (linkedAnnotation) {
          const targets = Array.isArray(linkedAnnotation.target)
            ? linkedAnnotation.target
            : [linkedAnnotation.target];

          const connectedLabels = targets
            .map((target: any) => {
              if (typeof target === 'string') {
                const annotation = existingAnnotations.find(
                  (ann) => ann.id === target,
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
              const annotation = existingAnnotations.find(
                (ann) => ann.id === target,
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

          const createTooltip = () => {
            const tooltip = document.createElement('div');
            tooltip.className = 'point-selector-tooltip';
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

            const content = document.createElement('div');
            content.style.cssText = `
              color: hsl(var(--card-foreground));
              line-height: 1.4;
            `;

            if (connectedLabels.length > 0) {
              const labelTexts = connectedLabels.map(
                (label: any) => label.text,
              );
              content.textContent = labelTexts.join(' + ');
            } else {
              content.textContent = `${targets.length} connection${
                targets.length !== 1 ? 's' : ''
              }`;
            }

            tooltip.appendChild(content);
            document.body.appendChild(tooltip);

            return tooltip;
          };

          let tooltip: HTMLElement | null = null;

          indicator.addEventListener('mouseenter', (e) => {
            tooltip = createTooltip();
            const rect = indicator.getBoundingClientRect();
            tooltip.style.left = `${rect.left + rect.width / 2}px`;
            tooltip.style.top = `${rect.top - 10}px`;
            tooltip.style.transform = 'translate(-50%, -100%)';

            setTimeout(() => {
              if (tooltip) {
                const tooltipRect = tooltip.getBoundingClientRect();
                if (tooltipRect.left < 10) {
                  tooltip.style.left = '10px';
                  tooltip.style.transform = 'translateY(-100%)';
                } else if (tooltipRect.right > window.innerWidth - 10) {
                  tooltip.style.left = `${window.innerWidth - 10}px`;
                  tooltip.style.transform = 'translate(-100%, -100%)';
                }
                tooltip.style.opacity = '1';
              }
            }, 10);
          });

          indicator.addEventListener('mouseleave', () => {
            if (tooltip) {
              tooltip.style.opacity = '0';
              setTimeout(() => {
                if (tooltip && tooltip.parentNode) {
                  tooltip.parentNode.removeChild(tooltip);
                }
                tooltip = null;
              }, 200);
            }
          });
        }
      }

      const container = viewer.element;
      container.appendChild(indicator);
      const updateIndicatorPosition = () => {
        try {
          const pixelPoint =
            viewer.viewport.viewportToViewerElementCoordinates(viewportPoint);
          indicator.style.left = pixelPoint.x + 'px';
          indicator.style.top = pixelPoint.y + 'px';
        } catch (error) {}
      };
      updateIndicatorPosition();
      const handlerKey = `${indicatorId}`;
      eventHandlers.current.set(
        `${handlerKey}-animation`,
        updateIndicatorPosition,
      );
      eventHandlers.current.set(`${handlerKey}-zoom`, updateIndicatorPosition);
      eventHandlers.current.set(`${handlerKey}-pan`, updateIndicatorPosition);
      viewer.addHandler('animation', updateIndicatorPosition);
      viewer.addHandler('zoom', updateIndicatorPosition);
      viewer.addHandler('pan', updateIndicatorPosition);
    } catch (error) {}
  };

  const removePointIndicator = (viewer: any) => {
    try {
      const existingIndicator = document.getElementById(
        'point-selector-indicator',
      );
      if (existingIndicator) {
        existingIndicator.remove();
      }

      if (!viewer) return;

      const handlerKey = 'point-selector-indicator';
      const animationHandler = eventHandlers.current.get(
        `${handlerKey}-animation`,
      );
      const zoomHandler = eventHandlers.current.get(`${handlerKey}-zoom`);
      const panHandler = eventHandlers.current.get(`${handlerKey}-pan`);

      if (animationHandler) {
        viewer.removeHandler('animation', animationHandler);
        eventHandlers.current.delete(`${handlerKey}-animation`);
      }
      if (zoomHandler) {
        viewer.removeHandler('zoom', zoomHandler);
        eventHandlers.current.delete(`${handlerKey}-zoom`);
      }
      if (panHandler) {
        viewer.removeHandler('pan', panHandler);
        eventHandlers.current.delete(`${handlerKey}-pan`);
      }
    } catch (error) {}
  };

  const removeAllPointIndicators = (viewer: any) => {
    try {
      const currentIndicator = document.getElementById(
        'point-selector-indicator',
      );
      if (currentIndicator) {
        currentIndicator.remove();
      }

      const existingPoints = getExistingPointSelectors();
      existingPoints.forEach((point) => {
        const indicator = document.getElementById(
          `point-selector-indicator-${point.annotationId}`,
        );
        if (indicator) {
          indicator.remove();
        }
      });

      const tooltips = document.querySelectorAll('.point-selector-tooltip');
      tooltips.forEach((tooltip) => {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      });

      if (viewer) {
        eventHandlers.current.forEach((handler, key) => {
          const parts = key.split('-');
          const eventType = parts[parts.length - 1];
          if (['animation', 'zoom', 'pan'].includes(eventType)) {
            viewer.removeHandler(eventType, handler);
          }
        });
      }
      eventHandlers.current.clear();
    } catch (error) {}
  };

  const addAllPointIndicators = (viewer: any) => {
    try {
      removeAllPointIndicators(viewer);
      if (selectedPoint) {
        addPointIndicator(selectedPoint.x, selectedPoint.y, viewer, 'current');
      }
      const existingPoints = getExistingPointSelectors();
      existingPoints.forEach((point) => {
        if (
          !selectedPoint ||
          selectedPoint.x !== point.x ||
          selectedPoint.y !== point.y
        ) {
          addPointIndicator(
            point.x,
            point.y,
            viewer,
            'existing',
            point.annotationId,
          );
        }
      });
    } catch (error) {}
  };

  useEffect(() => {
    setSelectedPoint(value || null);
  }, [value, existingAnnotations]);

  const handleStartSelection = () => {
    if (disabled) return;

    setIsSelecting(true);

    if (typeof onStartSelecting === 'function') {
      onStartSelecting();
    }

    if (isViewerReady()) {
      const viewer = (window as any).osdViewer;
      const canvas = viewer.canvas;

      if (canvas) {
        canvas.style.cursor = CROSSHAIR_CURSOR;
      }

      const handleViewerClick = (event: any) => {
        event.preventDefaultAction = true;

        if (canvas) {
          canvas.style.cursor = '';
        }

        const viewportPoint = viewer.viewport.pointFromPixel(event.position);
        const imagePoint =
          viewer.viewport.viewportToImageCoordinates(viewportPoint);
        const imageSize = viewer.world.getItemAt(0).getContentSize();

        const pixelX = Math.round(
          Math.max(0, Math.min(imagePoint.x, imageSize.x)),
        );
        const pixelY = Math.round(
          Math.max(0, Math.min(imagePoint.y, imageSize.y)),
        );

        const newPoint = { x: pixelX, y: pixelY };

        setSelectedPoint(newPoint);
        setIsSelecting(false);
        onChange(newPoint);

        if (typeof keepExpanded === 'function') {
          keepExpanded();
        }

        viewer.removeHandler('canvas-click', handleViewerClick);
      };

      eventHandlers.current.set('canvas-click-handler', handleViewerClick);
      viewer.addHandler('canvas-click', handleViewerClick);
    }
  };

  const handleClearSelection = () => {
    setSelectedPoint(null);
    setIsSelecting(false);

    if (isViewerReady()) {
      const viewer = (window as any).osdViewer;
      const canvas = viewer.canvas;
      if (canvas) {
        canvas.style.cursor = '';
      }

      const clickHandler = eventHandlers.current.get('canvas-click-handler');
      if (clickHandler) {
        viewer.removeHandler('canvas-click', clickHandler);
        eventHandlers.current.delete('canvas-click-handler');
      }

      viewer.removeAllHandlers('canvas-click');
    }

    onChange(null);
  };

  useEffect(() => {
    return () => {
      if (isViewerReady()) {
        const viewer = (window as any).osdViewer;

        const clickHandler = eventHandlers.current.get('canvas-click-handler');
        if (clickHandler) {
          viewer.removeHandler('canvas-click', clickHandler);
        }

        eventHandlers.current.forEach((handler, key) => {
          const parts = key.split('-');
          const eventType = parts[parts.length - 1];
          if (['animation', 'zoom', 'pan'].includes(eventType)) {
            viewer.removeHandler(eventType, handler);
          } else if (key === 'canvas-click-handler') {
            viewer.removeHandler('canvas-click', handler);
          }
        });

        const canvas = viewer.canvas;
        if (canvas) {
          canvas.style.cursor = '';
        }

        removeAllPointIndicators(viewer);
      }

      eventHandlers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (isViewerReady()) {
      const viewer = (window as any).osdViewer;
      addAllPointIndicators(viewer);
    }
  }, [selectedPoint, existingAnnotations]);

  return (
    <div
      className={`space-y-2 ${
        expandedStyle ? 'w-full max-w-full' : ''
      } overflow-hidden`}
    >
      {selectedPoint ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-secondary/10 border border-secondary/30 rounded-md">
            <Plus className="w-4 h-4 text-foreground flex-shrink-0" />
            <div className="flex-1 text-sm min-w-0">
              <div className="font-medium text-foreground">Point selected</div>
              <div className="text-xs text-muted-foreground truncate">
                {selectedPoint.x}, {selectedPoint.y}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
              disabled={disabled}
              title="Clear selected point"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartSelection}
            disabled={disabled || isSelecting}
            className="w-full justify-center items-center gap-2 border-secondary/30 hover:bg-secondary hover:text-secondary-foreground"
          >
            <Target className="w-3 h-3" />
            {isSelecting ? 'Click on image...' : 'Change point'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartSelection}
            disabled={disabled}
            className="w-full justify-center items-center gap-2 border-primary/30 hover:bg-primary hover:text-primary-foreground"
          >
            <Target className="w-3 h-3" />
            Select point
          </Button>
        </div>
      )}
      {(selectedPoint || getExistingPointSelectors().length > 0) && (
        <div className="text-xs text-muted-foreground bg-muted/20 p-2 rounded border">
          <div className="space-y-1">
            {selectedPoint && (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 border-2 border-white rounded-full shadow-sm"
                  style={{ backgroundColor: 'hsl(var(--secondary))' }}
                ></div>
                <span>Selected point</span>
              </div>
            )}
            {getExistingPointSelectors().length > 0 && (
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 border border-white rounded-full opacity-95 shadow-sm"
                  style={{ backgroundColor: 'hsl(var(--primary))' }}
                ></div>
                <span>Other points</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
