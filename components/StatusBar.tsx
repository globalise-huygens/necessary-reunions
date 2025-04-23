'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface StatusBarProps {
  manifest: any;
  currentCanvas: number;
  totalCanvases: number;
  onCanvasChange?: (index: number) => void;
  viewer?: {
    viewport?: any;
    addHandler?: (event: string, handler: () => void) => void;
    removeHandler?: (event: string, handler: () => void) => void;
  };
  viewMode?: 'image' | 'map';
}

export function StatusBar({
  manifest,
  currentCanvas,
  totalCanvases,
  onCanvasChange,
  viewer,
  viewMode = 'image',
}: StatusBarProps) {
  const [zoomLevel, setZoomLevel] = useState(100);

  useEffect(() => {
    if (viewMode === 'image' && viewer?.viewport) {
      const updateZoom = () => {
        const currentZoom = viewer.viewport.getZoom();
        const homeZoom = viewer.viewport.getHomeZoom();
        setZoomLevel(Math.round((currentZoom / homeZoom) * 100));
      };
      updateZoom();
      viewer?.addHandler?.('zoom', updateZoom);
      return () => viewer?.removeHandler?.('zoom', updateZoom);
    }
  }, [viewer, viewMode]);

  const handleZoom = (factor: number) => {
    if (viewMode === 'image' && viewer?.viewport) {
      viewer.viewport.zoomBy(factor);
      viewer.viewport.applyConstraints();
    }
  };

  const handleReset = () => {
    if (viewMode === 'image' && viewer?.viewport) {
      viewer.viewport.goHome();
    }
  };

  return (
    <div className="border-t py-1.5 px-4 flex items-center justify-between bg-muted/20 text-sm">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onCanvasChange?.(currentCanvas - 1)}
          disabled={currentCanvas <= 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span>
          {currentCanvas + 1} of {totalCanvases}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onCanvasChange?.(currentCanvas + 1)}
          disabled={currentCanvas >= totalCanvases - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="text-muted-foreground">
        {manifest.items?.[currentCanvas]?.width || 0} ×{' '}
        {manifest.items?.[currentCanvas]?.height || 0}
      </div>
    </div>
  );
}
