import React from 'react';

/**
 * Utility functions for optimized overlay management in ImageViewer
 */
export interface OverlayOptions {
  backgroundColor?: string;
  border?: string;
  size?: number;
  zIndex?: number;
  isSelected?: boolean;
}

export class OverlayManager {
  private viewer: any;
  private osd: any;
  private overlays: Map<string, HTMLElement> = new Map();
  private pendingUpdates: Set<string> = new Set();
  private updateTimeout: NodeJS.Timeout | null = null;

  constructor(viewer: any, osd: any) {
    this.viewer = viewer;
    this.osd = osd;
  }

  /**
   * Creates or updates a point overlay with throttling
   */
  createPointOverlay(
    id: string,
    x: number,
    y: number,
    options: OverlayOptions = {},
  ) {
    const {
      backgroundColor = 'hsl(45 64% 59% / 0.9)',
      border = '2px solid white',
      size = 8,
      zIndex = 100,
      isSelected = false,
    } = options;

    this.removeOverlay(id);

    const pointDiv = document.createElement('div');
    pointDiv.id = `overlay-${id}`;
    pointDiv.dataset.overlayId = id;
    pointDiv.dataset.isPointOverlay = 'true';

    const actualSize = isSelected ? size + 2 : size;
    const selectedBorder = isSelected ? '3px solid #ff4444' : border;

    Object.assign(pointDiv.style, {
      position: 'absolute',
      width: `${actualSize}px`,
      height: `${actualSize}px`,
      backgroundColor,
      border: selectedBorder,
      borderRadius: '50%',
      pointerEvents: 'none',
      zIndex: zIndex.toString(),
      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      transition: 'all 0.2s ease-in-out',
    });

    if (!this.viewer.world || this.viewer.world.getItemCount() === 0) {
      return;
    }

    try {
      const viewportPoint = this.viewer.viewport.imageToViewportCoordinates(
        new this.osd.Point(x, y),
      );

      this.viewer.addOverlay({
        element: pointDiv,
        location: viewportPoint,
      });

      this.overlays.set(id, pointDiv);
    } catch (error) {
      console.warn('Failed to create point overlay:', error);
    }
  }

  /**
   * Removes an overlay by ID
   */
  removeOverlay(id: string) {
    const overlay = this.overlays.get(id);
    if (overlay) {
      try {
        this.viewer.removeOverlay(overlay);
        this.overlays.delete(id);
      } catch (error) {
        this.overlays.delete(id);
      }
    }
  }

  /**
   * Clears all managed overlays
   */
  clearAllOverlays() {
    this.overlays.forEach((overlay, id) => {
      this.removeOverlay(id);
    });
    this.overlays.clear();
    this.pendingUpdates.clear();

    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
  }

  /**
   * Batch update overlays to reduce re-renders
   */
  batchUpdateOverlays(
    updates: Array<{
      id: string;
      x: number;
      y: number;
      options?: OverlayOptions;
    }>,
  ) {
    updates.forEach(({ id, x, y, options }) => {
      this.pendingUpdates.add(id);
    });

    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = setTimeout(() => {
      updates.forEach(({ id, x, y, options = {} }) => {
        if (this.pendingUpdates.has(id)) {
          this.createPointOverlay(id, x, y, options);
          this.pendingUpdates.delete(id);
        }
      });
      this.updateTimeout = null;
    }, 50);
  }

  /**
   * Updates overlay selection state
   */
  updateOverlaySelection(selectedId: string | null) {
    this.overlays.forEach((overlay, id) => {
      const isSelected = id === selectedId;
      const border = isSelected ? '3px solid #ff4444' : '2px solid white';
      const scale = isSelected ? '1.2' : '1';

      overlay.style.border = border;
      overlay.style.transform = `scale(${scale})`;
    });
  }
}

/**
 * Hook for managing overlay state efficiently
 */
export function useOverlayManager(viewer: any, osd: any) {
  const managerRef = React.useRef<OverlayManager | null>(null);

  React.useEffect(() => {
    if (viewer && osd) {
      managerRef.current = new OverlayManager(viewer, osd);
    }

    return () => {
      if (managerRef.current) {
        managerRef.current.clearAllOverlays();
        managerRef.current = null;
      }
    };
  }, [viewer, osd]);

  return managerRef.current;
}

export default OverlayManager;
