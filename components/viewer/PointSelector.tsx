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
  viewer?: any; // Pass viewer directly instead of using global
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
  viewer, // Use the passed viewer instead of global
}: PointSelectorProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<{
    x: number;
    y: number;
  } | null>(value || null);
  const eventHandlers = useRef<Map<string, Function>>(new Map());
  const lastAnnotationsRef = useRef<string>(''); // Track stable annotation state

  // Check if annotations have meaningfully changed (not just reference change)
  const annotationsChanged = () => {
    const currentAnnotationsHash = JSON.stringify(
      existingAnnotations
        ?.map((ann) => ({
          id: ann.id,
          target: ann.target,
          body: ann.body?.filter(
            (b: any) =>
              b.purpose === 'selecting' && b.selector?.type === 'PointSelector',
          ),
        }))
        ?.sort((a, b) => a.id.localeCompare(b.id)) || [],
    );

    if (lastAnnotationsRef.current !== currentAnnotationsHash) {
      lastAnnotationsRef.current = currentAnnotationsHash;
      return true;
    }
    return false;
  };

  const isViewerReady = () => {
    try {
      return (
        viewer &&
        viewer.world &&
        viewer.world.getItemCount() > 0 &&
        viewer.element &&
        viewer.viewport
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
    existingAnnotations.forEach((annotation, index) => {
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
            const point = {
              x: selector.x,
              y: selector.y,
              annotationId: annotation.id,
            };
            points.push(point);
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
      const canvasIdSuffix = canvasId ? `-${canvasId.split('/').pop()}` : '';
      const indicatorId =
        type === 'current'
          ? `point-selector-indicator${canvasIdSuffix}`
          : `point-selector-indicator-${annotationId}${canvasIdSuffix}`;

      const existingIndicator = document.getElementById(indicatorId);
      if (existingIndicator) {
        existingIndicator.remove();
      }
      if (!viewer || !viewer.world || viewer.world.getItemCount() === 0) {
        return;
      }

      // Use the same coordinate approach as ImageViewer for consistency
      // We need OpenSeadragon's Point constructor
      const OpenSeadragon = (window as any).OpenSeadragon;
      if (!OpenSeadragon) {
        console.warn('OpenSeadragon not available for point creation');
        return;
      }

      const viewportPoint = viewer.viewport.imageToViewportCoordinates(
        new OpenSeadragon.Point(x, y),
      );

      const indicator = document.createElement('div');
      indicator.id = indicatorId;

      // Use enhanced colors for better visibility
      const backgroundColor = type === 'current' 
        ? '#f59e0b' // Amber-500 for current point
        : '#059669'; // Emerald-600 for existing points
      const borderColor = 'white';
      const size = type === 'current' ? '14px' : '12px'; // Slightly larger for better visibility
      const zIndex = type === 'current' ? '101' : '99';
      const pointerEvents = type === 'existing' ? 'auto' : 'none';
      const opacity = type === 'existing' ? '1.0' : '1.0'; // Full opacity for both

      // Set styles individually for better reliability
      indicator.style.position = 'absolute';
      indicator.style.width = size;
      indicator.style.height = size;
      indicator.style.background = backgroundColor;
      indicator.style.border = `2px solid ${borderColor}`;
      indicator.style.borderRadius = '50%';
      indicator.style.transform = 'translate(-50%, -50%)';
      indicator.style.pointerEvents = pointerEvents;
      indicator.style.zIndex = zIndex;
      indicator.style.boxShadow = type === 'current' 
        ? '0 3px 12px rgba(245, 158, 11, 0.6), 0 1px 3px rgba(0, 0, 0, 0.2)'
        : '0 2px 8px rgba(5, 150, 105, 0.4), 0 1px 3px rgba(0, 0, 0, 0.2)';
      indicator.style.cursor = type === 'existing' ? 'help' : 'default';
      indicator.style.opacity = opacity;
      indicator.style.transition = 'all 0.2s ease';
      if (type === 'current') {
        indicator.style.outline = '2px solid rgba(245, 158, 11, 0.3)';
        indicator.style.outlineOffset = '2px';
      }

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

      // Use OpenSeadragon overlay system like ImageViewer for proper z-index and positioning
      viewer.addOverlay({
        element: indicator,
        location: viewportPoint,
      });
    } catch (error) {
      console.error('Error adding point indicator:', error);
    }
  };

  const removePointIndicator = (viewer: any) => {
    try {
      const canvasIdSuffix = canvasId ? `-${canvasId.split('/').pop()}` : '';
      const indicatorId = `point-selector-indicator${canvasIdSuffix}`;

      if (!viewer) return;

      // Find the overlay element by ID and remove it
      const overlays = viewer.currentOverlays || [];
      const overlayToRemove = overlays.find(
        (overlay: any) => overlay.element && overlay.element.id === indicatorId,
      );

      if (overlayToRemove) {
        viewer.removeOverlay(overlayToRemove.element);
      }
    } catch (error) {
      console.error('Error removing point indicator:', error);
    }
  };

  const removeAllPointIndicators = (viewer: any) => {
    try {
      if (!viewer) return;

      const canvasIdSuffix = canvasId ? `-${canvasId.split('/').pop()}` : '';

      // Remove current point indicator
      const currentIndicatorId = `point-selector-indicator${canvasIdSuffix}`;

      // Remove existing point indicators
      const existingPoints = getExistingPointSelectors();
      const indicatorIds = [
        currentIndicatorId,
        ...existingPoints.map(
          (point) =>
            `point-selector-indicator-${point.annotationId}${canvasIdSuffix}`,
        ),
      ];

      // Find and remove overlays by ID
      const overlays = viewer.currentOverlays || [];
      overlays.forEach((overlay: any) => {
        if (overlay.element && indicatorIds.includes(overlay.element.id)) {
          viewer.removeOverlay(overlay.element);
        }
      });

      // Clean up tooltips
      const tooltips = document.querySelectorAll('.point-selector-tooltip');
      tooltips.forEach((tooltip) => {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      });

      // Clear event handlers
      eventHandlers.current.clear();
    } catch (error) {
      console.error('Error removing all point indicators:', error);
    }
  };

  const addAllPointIndicators = (viewer: any) => {
    try {
      removeAllPointIndicators(viewer);

      // Add current point indicator
      if (selectedPoint) {
        addPointIndicator(selectedPoint.x, selectedPoint.y, viewer, 'current');
      }

      // Add existing point indicators
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
    } catch (error) {
      console.error('Error adding point indicators:', error);
    }
  };

  useEffect(() => {
    setSelectedPoint(value || null);
  }, [value, existingAnnotations]);

  useEffect(() => {
    // Clean up previous canvas overlays when canvas changes
    return () => {
      if (viewer) {
        // Remove all overlays from the current viewer when canvas changes
        const overlays = viewer.currentOverlays || [];
        overlays.forEach((overlay: any) => {
          if (
            overlay.element &&
            overlay.element.id &&
            overlay.element.id.includes('point-selector-indicator')
          ) {
            try {
              viewer.removeOverlay(overlay.element);
            } catch (e) {
              console.warn('Failed to remove overlay:', e);
            }
          }
        });
      }
    };
  }, [canvasId, viewer]);

  useEffect(() => {
    return () => {
      if (isViewerReady()) {
        removeAllPointIndicators(viewer);
      } else {
        const canvasIdSuffix = canvasId ? `-${canvasId.split('/').pop()}` : '';
        const currentIndicator = document.getElementById(
          `point-selector-indicator${canvasIdSuffix}`,
        );
        if (currentIndicator) {
          currentIndicator.remove();
        }

        const existingPoints = getExistingPointSelectors();
        existingPoints.forEach((point) => {
          const indicator = document.getElementById(
            `point-selector-indicator-${point.annotationId}${canvasIdSuffix}`,
          );
          if (indicator) {
            indicator.remove();
          }
        });
      }
    };
  }, [canvasId, currentAnnotationId, viewer]);

  const handleStartSelection = () => {
    if (disabled || !viewer) return;

    setIsSelecting(true);

    if (typeof onStartSelecting === 'function') {
      onStartSelecting();
    }

    if (isViewerReady()) {
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
      // Only refresh if annotations have meaningfully changed or selectedPoint changed
      const shouldRefresh = annotationsChanged() || selectedPoint !== value;

      if (shouldRefresh) {
        // Use a small delay to allow other operations to complete
        const refreshTimer = setTimeout(() => {
          if (isViewerReady()) {
            // First, clean up ALL existing point overlays from this viewer
            if (viewer.currentOverlays) {
              const overlaysToRemove = viewer.currentOverlays.filter(
                (overlay: any) =>
                  overlay.element &&
                  overlay.element.id &&
                  overlay.element.id.includes('point-selector-indicator'),
              );

              overlaysToRemove.forEach((overlay: any) => {
                try {
                  viewer.removeOverlay(overlay.element);
                } catch (e) {
                  console.warn('Failed to remove overlay:', e);
                }
              });
            }

            // Then add the new ones for this canvas
            addAllPointIndicators(viewer);
          }
        }, 50); // Small delay to prevent rapid recreation

        return () => clearTimeout(refreshTimer);
      }
    } else {
      // Retry after a short delay if viewer isn't ready
      const retryTimer = setTimeout(() => {
        if (isViewerReady()) {
          addAllPointIndicators(viewer);
        }
      }, 100);

      return () => clearTimeout(retryTimer);
    }
  }, [selectedPoint, canvasId, viewer]); // Removed existingAnnotations from deps

  // Separate effect to handle annotation changes more intelligently
  useEffect(() => {
    if (isViewerReady() && annotationsChanged()) {
      // Small delay to prevent rapid recreation during batch updates
      const updateTimer = setTimeout(() => {
        if (isViewerReady()) {
          addAllPointIndicators(viewer);
        }
      }, 100);

      return () => clearTimeout(updateTimer);
    }
  }, [existingAnnotations]); // Only watch for annotation changes

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
