'use client';

import { GripVertical } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ResizableSidebarProps {
  children: React.ReactNode;
  /** Side the drag handle appears on */
  side: 'left' | 'right';
  /** Default width in px */
  defaultWidth: number;
  /** Minimum width in px */
  minWidth?: number;
  /** Maximum width in px */
  maxWidth?: number;
  /** localStorage key for persisting width */
  storageKey?: string;
  /** Additional className for the outer container */
  className?: string;
}

/**
 * Wraps content in a resizable panel with a drag handle.
 * The handle appears on the `side` edge (the edge facing the centre panel).
 * Width persists across sessions via localStorage.
 */
export function ResizableSidebar({
  children,
  side,
  defaultWidth,
  minWidth = 280,
  maxWidth = 700,
  storageKey,
  className = '',
}: ResizableSidebarProps) {
  const [width, setWidth] = useState(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed;
        }
      }
    }
    return defaultWidth;
  });

  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist width to localStorage
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, String(width));
    }
  }, [width, storageKey]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - startX.current;
      // For the right sidebar, dragging left increases width (handle is on left edge)
      // For a left sidebar, dragging right increases width (handle is on right edge)
      const newWidth =
        side === 'right'
          ? startWidth.current - delta
          : startWidth.current + delta;
      setWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [side, minWidth, maxWidth]);

  // Double-click to reset to default
  const handleDoubleClick = useCallback(() => {
    setWidth(defaultWidth);
  }, [defaultWidth]);

  const handle = (
    <button
      type="button"
      aria-label="Resize sidebar — drag to adjust, double-click to reset"
      className="group flex w-2 cursor-col-resize items-center justify-center hover:bg-accent/50 active:bg-accent/80 transition-colors border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          setWidth((w) => Math.max(minWidth, Math.min(maxWidth, w - 20)));
        } else if (e.key === 'ArrowRight') {
          setWidth((w) => Math.max(minWidth, Math.min(maxWidth, w + 20)));
        }
      }}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors" />
    </button>
  );

  return (
    <div
      ref={containerRef}
      className={`flex flex-col overflow-hidden ${className}`}
      style={{ width, minWidth, maxWidth, flexShrink: 0 }}
    >
      <div className="flex flex-1 overflow-hidden">
        {side === 'right' && handle}
        <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
        {side === 'left' && handle}
      </div>
    </div>
  );
}
