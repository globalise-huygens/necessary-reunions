'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { X, MapPin, Target } from 'lucide-react';

interface PointSelectorProps {
  value?: { x: number; y: number } | null;
  onChange: (point: { x: number; y: number } | null) => void;
  canvasId?: string;
  manifestId?: string;
  disabled?: boolean;
  expandedStyle?: boolean;
  existingAnnotations?: any[];
  currentAnnotationId?: string;
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
}: PointSelectorProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<{
    x: number;
    y: number;
  } | null>(value || null);

  useEffect(() => {
    setSelectedPoint(value || null);
  }, [value]);

  const eventHandlers = React.useRef<Map<string, Function>>(new Map());

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

    existingAnnotations.forEach((annotation, index) => {
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

      indicator.style.cssText = `
      position: absolute;
      width: ${size};
      height: ${size};
      background: ${backgroundColor};
      border: 2px solid white;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: ${zIndex};
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ${type === 'existing' ? 'opacity: 0.8;' : ''}
    `;

      const container = viewer.element;
      container.appendChild(indicator);

      const updateIndicatorPosition = () => {
        const pixelPoint =
          viewer.viewport.viewportToViewerElementCoordinates(viewportPoint);
        indicator.style.left = pixelPoint.x + 'px';
        indicator.style.top = pixelPoint.y + 'px';
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
    const existingIndicator = document.getElementById(
      'point-selector-indicator',
    );
    if (existingIndicator) {
      existingIndicator.remove();
    }

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

      eventHandlers.current.forEach((handler, key) => {
        const parts = key.split('-');
        const eventType = parts[parts.length - 1];
        if (['animation', 'zoom', 'pan'].includes(eventType)) {
          viewer.removeHandler(eventType, handler);
        }
      });
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

    if (isViewerReady()) {
      const viewer = (window as any).osdViewer;

      const canvas = viewer.canvas;
      if (canvas) {
        canvas.style.cursor = `url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='16' cy='16' r='4' fill='%23d4a548' stroke='%23ffffff' stroke-width='2'/%3E%3Cpath d='M16 4v8m0 8v8M4 16h8m8 0h8' stroke='%23d4a548' stroke-width='2' opacity='0.9'/%3E%3C/svg%3E") 16 16, crosshair`;
      }

      const handleViewerClick = (event: any) => {
        event.preventDefaultAction = true;

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
        onChange(newPoint);
        setIsSelecting(false);

        if (canvas) {
          canvas.style.cursor = '';
        }

        viewer.removeHandler('canvas-click', handleViewerClick);
      };

      viewer.addHandler('canvas-click', handleViewerClick);
    }
  };

  const handleClearSelection = () => {
    setSelectedPoint(null);
    onChange(null);
    setIsSelecting(false);

    if (isViewerReady()) {
      const viewer = (window as any).osdViewer;
      viewer.removeAllHandlers('canvas-click');

      const canvas = viewer.canvas;
      if (canvas) {
        canvas.style.cursor = '';
      }
    }
  };

  useEffect(() => {
    return () => {
      if (isViewerReady()) {
        const viewer = (window as any).osdViewer;
        viewer.removeAllHandlers('canvas-click');

        const canvas = viewer.canvas;
        if (canvas) {
          canvas.style.cursor = '';
        }
      }
    };
  }, []);

  return (
    <div
      className={`space-y-2 ${
        expandedStyle ? 'w-full max-w-full' : ''
      } overflow-hidden`}
    >
      <div className="flex items-center justify-between">
        {/* <label className="text-xs font-medium text-foreground truncate">
          Map Point {selectedPoint ? '(click to change)' : '(optional)'}:
        </label> */}
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
                Coordinates: ({selectedPoint.x}, {selectedPoint.y})
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
            {isSelecting ? 'Click on image...' : 'Change Point'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Clear value proposition */}
          {/* <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <Target className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-blue-900 text-sm">
                  Mark Location on Image
                </div>
                <div className="text-xs text-blue-700 mt-1">
                  Click a point on the image that corresponds to the real-world
                  location. This helps link the annotation to geographic data.
                </div>
              </div>
            </div>
          </div> */}

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
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ backgroundColor: 'hsl(45, 64%, 59%)' }}
            />
            <div className="flex-1">
              <div className="font-medium text-amber-900 text-sm">
                Click on the Image
              </div>
              <div className="text-xs text-amber-700">
                Your cursor has changed to a crosshair. Click anywhere on the
                image to mark the location.
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsSelecting(false);
                if (
                  typeof window !== 'undefined' &&
                  (window as any).osdViewer
                ) {
                  const viewer = (window as any).osdViewer;
                  const canvas = viewer.canvas;
                  if (canvas) {
                    canvas.style.cursor = '';
                  }
                  viewer.removeAllHandlers('canvas-click');
                }
              }}
              className="text-amber-600 hover:text-amber-800"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {(selectedPoint || getExistingPointSelectors().length > 0) && (
        <div className="text-xs text-muted-foreground bg-muted/20 p-2 rounded border">
          <div className="font-medium mb-1">Map Points Legend:</div>
          <div className="space-y-1">
            {selectedPoint && (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 border-2 border-white rounded-full shadow-sm"
                  style={{ backgroundColor: 'hsl(45, 64%, 59%)' }}
                ></div>
                <span>Current selection</span>
              </div>
            )}
            {getExistingPointSelectors().length > 0 && (
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 border border-white rounded-full opacity-95 shadow-sm"
                  style={{ backgroundColor: 'hsl(165, 22%, 26%)' }}
                ></div>
                <span>Saved point selectors from other annotations</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
