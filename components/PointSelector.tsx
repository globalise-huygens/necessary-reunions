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
}

export function PointSelector({
  value,
  onChange,
  canvasId,
  manifestId,
  disabled = false,
  expandedStyle = false,
}: PointSelectorProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<{
    x: number;
    y: number;
  } | null>(value || null);

  // Helper function to add a visual indicator on the image
  const addPointIndicator = (x: number, y: number, viewer: any) => {
    // Remove any existing indicators
    removePointIndicator(viewer);

    // Convert pixel coordinates back to image coordinates
    const imageSize = viewer.world.getItemAt(0).getContentSize();
    const imageBounds = viewer.world.getItemAt(0).getBounds();

    const imageX = (x / imageSize.x) * imageBounds.width;
    const imageY = (y / imageSize.y) * imageBounds.height;

    // Convert to viewport coordinates
    const viewportPoint = viewer.viewport.imageToViewportCoordinates(
      imageX,
      imageY,
    );

    // Create a point indicator element
    const indicator = document.createElement('div');
    indicator.id = 'point-selector-indicator';
    indicator.style.cssText = `
      position: absolute;
      width: 12px;
      height: 12px;
      background: #dc2626;
      border: 2px solid white;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    `;

    // Add to viewer container
    const container = viewer.element;
    container.appendChild(indicator);

    // Position the indicator
    const updateIndicatorPosition = () => {
      const pixelPoint =
        viewer.viewport.viewportToViewerElementCoordinates(viewportPoint);
      indicator.style.left = pixelPoint.x + 'px';
      indicator.style.top = pixelPoint.y + 'px';
    };

    updateIndicatorPosition();

    // Update position when viewport changes
    viewer.addHandler('animation', updateIndicatorPosition);
    viewer.addHandler('zoom', updateIndicatorPosition);
    viewer.addHandler('pan', updateIndicatorPosition);
  };

  // Helper function to remove point indicator
  const removePointIndicator = (viewer: any) => {
    const existingIndicator = document.getElementById(
      'point-selector-indicator',
    );
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Remove event handlers
    viewer.removeHandler('animation', () => {});
    viewer.removeHandler('zoom', () => {});
    viewer.removeHandler('pan', () => {});
  };

  useEffect(() => {
    setSelectedPoint(value || null);

    // Show indicator for existing point
    if (value && typeof window !== 'undefined' && (window as any).osdViewer) {
      const viewer = (window as any).osdViewer;
      addPointIndicator(value.x, value.y, viewer);
    } else if (
      !value &&
      typeof window !== 'undefined' &&
      (window as any).osdViewer
    ) {
      // Remove indicator when value is cleared
      const viewer = (window as any).osdViewer;
      removePointIndicator(viewer);
    }
  }, [value]);

  const handleStartSelection = () => {
    if (disabled) return;

    setIsSelecting(true);

    // Add click listener to the OpenSeadragon viewer
    if (typeof window !== 'undefined' && (window as any).osdViewer) {
      const viewer = (window as any).osdViewer;

      // Change cursor to custom crosshair with dot
      const canvas = viewer.canvas;
      if (canvas) {
        canvas.style.cursor = `url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='16' cy='16' r='3' fill='%23dc2626' stroke='%23ffffff' stroke-width='1'/%3E%3Cpath d='M16 4v8m0 8v8M4 16h8m8 0h8' stroke='%23dc2626' stroke-width='1.5' opacity='0.8'/%3E%3C/svg%3E") 16 16, crosshair`;
      }

      const handleViewerClick = (event: any) => {
        event.preventDefaultAction = true;

        const viewportPoint = viewer.viewport.pointFromPixel(event.position);

        const imagePoint =
          viewer.viewport.viewportToImageCoordinates(viewportPoint);

        // Get image dimensions to convert to pixel coordinates
        const imageBounds = viewer.world.getItemAt(0).getBounds();
        const imageSize = viewer.world.getItemAt(0).getContentSize();

        // Convert to pixel coordinates
        const pixelX = Math.round(
          (imagePoint.x / imageBounds.width) * imageSize.x,
        );
        const pixelY = Math.round(
          (imagePoint.y / imageBounds.height) * imageSize.y,
        );

        const newPoint = { x: pixelX, y: pixelY };
        setSelectedPoint(newPoint);
        onChange(newPoint);
        setIsSelecting(false);

        // Add visual indicator on the image
        addPointIndicator(pixelX, pixelY, viewer);

        // Reset cursor
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

    // Clean up any pending event listeners and reset cursor
    if (typeof window !== 'undefined' && (window as any).osdViewer) {
      const viewer = (window as any).osdViewer;
      viewer.removeAllHandlers('canvas-click');

      // Remove visual indicator
      removePointIndicator(viewer);

      // Reset cursor
      const canvas = viewer.canvas;
      if (canvas) {
        canvas.style.cursor = '';
      }
    }
  };

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && (window as any).osdViewer) {
        const viewer = (window as any).osdViewer;
        viewer.removeAllHandlers('canvas-click');

        // Remove visual indicator
        removePointIndicator(viewer);

        // Reset cursor
        const canvas = viewer.canvas;
        if (canvas) {
          canvas.style.cursor = '';
        }
      }
    };
  }, []);

  return (
    <div className={`space-y-2 ${expandedStyle ? 'w-full' : ''}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground">
          Map Point {selectedPoint ? '(click to change)' : '(optional)'}:
        </label>
        {selectedPoint && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
            disabled={disabled}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      {selectedPoint ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
            <MapPin className="w-4 h-4 text-green-600" />
            <div className="flex-1 text-sm">
              <div className="font-medium text-green-800">Point selected</div>
              <div className="text-xs text-green-600">
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
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-dashed">
            Select a point on the image that represents the location of this
            place on the map/image.
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleStartSelection}
            disabled={disabled || isSelecting}
            className="w-full justify-center items-center gap-2"
          >
            <Target className="w-3 h-3" />
            {isSelecting
              ? 'Click on image to select...'
              : 'Select Point on Image'}
          </Button>
        </div>
      )}

      {isSelecting && (
        <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-200">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            Click anywhere on the image to select the point that represents this
            location.
          </div>
        </div>
      )}
    </div>
  );
}
