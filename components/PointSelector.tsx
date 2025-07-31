'use client';

import { MapPin, Target, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button';

const CROSSHAIR_CURSOR = `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 2v20M2 12h20' stroke='%23000000' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M12 2v20M2 12h20' stroke='%23ffffff' stroke-width='1' stroke-linecap='round'/%3E%3C/svg%3E") 8 8, crosshair`;

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
            b.purpose === 'identifying' &&
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
      const backgroundColor = type === 'current' ? '#dc2626' : '#059669';
      const size = type === 'current' ? '12px' : '8px';
      const zIndex = type === 'current' ? '1001' : '1000';
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
                if (annotation?.body?.[0]?.value) {
                  return (
                    annotation.body[0].value.substring(0, 40) +
                    (annotation.body[0].value.length > 40 ? '...' : '')
                  );
                }
              }
              return 'Unnamed annotation';
            })
            .filter(Boolean);

          const tooltipText =
            connectedLabels.length > 0
              ? `Linked point:\n${connectedLabels.join('\n')}`
              : `Linked point (${targets.length} connected annotation${
                  targets.length !== 1 ? 's' : ''
                })`;

          indicator.title = tooltipText;
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
      <div className="flex items-center justify-between">
        {selectedPoint && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 flex-shrink-0"
            disabled={disabled}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
      {selectedPoint ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
            <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
            <div className="flex-1 text-sm min-w-0">
              <div className="font-medium text-green-800">Point selected</div>
              <div className="text-xs text-green-600 truncate">
                ({selectedPoint.x}, {selectedPoint.y})
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartSelection}
            disabled={disabled || isSelecting}
            className="w-full justify-center items-center gap-2"
          >
            <Target className="w-3 h-3" />
            {isSelecting ? 'Click on image...' : 'Change'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartSelection}
            disabled={disabled}
            className="w-full justify-center items-center gap-2"
          >
            Select point
          </Button>
        </div>
      )}
      {isSelecting && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ backgroundColor: '#000000' }}
            />
            <div className="flex-1">
              <div className="font-medium text-blue-900 text-sm">
                Click on image
              </div>
              <div className="text-xs text-blue-700">
                Click anywhere on the image
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsSelecting(false);

                if (isViewerReady()) {
                  const viewer = (window as any).osdViewer;
                  if (viewer?.canvas) {
                    viewer.canvas.style.cursor = '';
                  }

                  const clickHandler = eventHandlers.current.get(
                    'canvas-click-handler',
                  );
                  if (clickHandler) {
                    viewer.removeHandler('canvas-click', clickHandler);
                    eventHandlers.current.delete('canvas-click-handler');
                  }
                }
              }}
              className="text-blue-600 hover:text-blue-800 flex-shrink-0"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {(selectedPoint || getExistingPointSelectors().length > 0) && (
        <div className="text-xs text-muted-foreground bg-muted/20 p-2 rounded border">
          <div className="font-medium mb-1">Legend:</div>
          <div className="space-y-1">
            {selectedPoint && (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 border-2 border-white rounded-full shadow-sm"
                  style={{ backgroundColor: 'hsl(45, 64%, 59%)' }}
                ></div>
                <span>Current</span>
              </div>
            )}
            {getExistingPointSelectors().length > 0 && (
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 border border-white rounded-full opacity-95 shadow-sm"
                  style={{ backgroundColor: 'hsl(165, 22%, 26%)' }}
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
