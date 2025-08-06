'use client';

import { useToast } from '@/hooks/use-toast';
import { Check, Image, Pen, SquareDashed, Type, Undo2, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Button } from './Button';

let OpenSeadragon: any;

interface DrawingToolsProps {
  viewer: any | null;
  canvasId: string;
  isVisible: boolean;
  onNewAnnotation: (annotation: any) => void;
  onDrawingStateChange?: (isDrawing: boolean) => void;
  selectedAnnotation?: any | null;
  onAnnotationUpdate?: (annotation: any) => void;
}

export function DrawingTools({
  viewer,
  canvasId,
  isVisible,
  onNewAnnotation,
  onDrawingStateChange,
  selectedAnnotation,
  onAnnotationUpdate,
}: DrawingToolsProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPolygon, setCurrentPolygon] = useState<Array<[number, number]>>(
    [],
  );
  const [annotationType, setAnnotationType] = useState<
    'textspotting' | 'iconography'
  >('textspotting');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editingPolygon, setEditingPolygon] = useState<Array<[number, number]>>(
    [],
  );
  const [editingAnnotation, setEditingAnnotation] = useState<any | null>(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(
    null,
  );
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(
    null,
  );
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(
    null,
  );

  const coordinatesCacheRef = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );
  const lastViewportStateRef = useRef<{ zoom: number; center: any } | null>(
    null,
  );

  const lastDrawCallRef = useRef<number>(0);
  const drawThrottleRef = useRef<number | null>(null);

  const lastDrawnPolygonRef = useRef<Array<[number, number]>>([]);
  const lastDrawnStateRef = useRef<{
    hoveredIndex: number | null;
    draggedIndex: number | null;
    selectedIndex: number | null;
  }>({ hoveredIndex: null, draggedIndex: null, selectedIndex: null });

  const [annotationCreatedToast, setAnnotationCreatedToast] = useState(false);
  const [annotationErrorToast, setAnnotationErrorToast] = useState(false);
  const [showDrawingStartToast, setShowDrawingStartToast] = useState(false);
  const [showCancelToast, setShowCancelToast] = useState(false);
  const [showNotEnoughPointsToast, setShowNotEnoughPointsToast] =
    useState(false);
  const [showUndoPointToast, setShowUndoPointToast] = useState(false);
  const [showEditStartToast, setShowEditStartToast] = useState(false);
  const [showEditSaveToast, setShowEditSaveToast] = useState(false);
  const [showEditCancelToast, setShowEditCancelToast] = useState(false);

  const pointOverlaysRef = useRef<any[]>([]);
  const lineOverlaysRef = useRef<any[]>([]);
  const clickHandlerRef = useRef<((event: any) => void) | null>(null);
  const dblClickHandlerRef = useRef<((event: any) => void) | null>(null);
  const keyHandlerRef = useRef<((event: any) => void) | null>(null);
  const mouseDownHandlerRef = useRef<((event: any) => void) | null>(null);
  const mouseMoveHandlerRef = useRef<((event: any) => void) | null>(null);
  const mouseUpHandlerRef = useRef<((event: any) => void) | null>(null);
  const canvasMouseDownHandlerRef = useRef<
    ((event: MouseEvent) => void) | null
  >(null);
  const canvasMouseMoveHandlerRef = useRef<
    ((event: MouseEvent) => void) | null
  >(null);
  const canvasMouseUpHandlerRef = useRef<((event: MouseEvent) => void) | null>(
    null,
  );
  const canvasDoubleClickHandlerRef = useRef<
    ((event: MouseEvent) => void) | null
  >(null);
  const polygonOverlayRef = useRef<any>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const editingOverlayRef = useRef<HTMLDivElement | null>(null);
  const drawingOverlayRef = useRef<any>(null);
  const viewportStateRef = useRef<{
    center: any;
    zoom: number;
    bounds: any;
  } | null>(null);
  const { data: session } = useSession();
  const { toast } = useToast();

  const isMounted = useRef(false);
  const isToastReady = useRef(false);

  useLayoutEffect(() => {
    isMounted.current = true;
    setTimeout(() => {
      isToastReady.current = true;
    }, 100);
    return () => {
      isMounted.current = false;
      isToastReady.current = false;
    };
  }, []);

  useEffect(() => {
    onDrawingStateChange?.(isDrawing || isEditing);
  }, [isDrawing, isEditing, onDrawingStateChange]);

  useEffect(() => {
    if (selectedAnnotation !== editingAnnotation) {
      clearOverlays();

      if (isEditing) {
        setIsEditing(false);
        setEditingPolygon([]);
        setEditingAnnotation(null);
        setHoveredPointIndex(null);
        setDraggedPointIndex(null);
        setSelectedPointIndex(null);

        lastDrawnPolygonRef.current = [];
        lastDrawnStateRef.current = {
          hoveredIndex: null,
          draggedIndex: null,
          selectedIndex: null,
        };
        coordinatesCacheRef.current.clear();
      }
    }
  }, [selectedAnnotation, isEditing, editingAnnotation, session]);

  useEffect(() => {
    async function loadOpenSeadragon() {
      if (!OpenSeadragon) {
        const { default: OSD } = await import('openseadragon');
        OpenSeadragon = OSD;
      }
    }
    loadOpenSeadragon();
  }, []);

  useEffect(() => {
    if (annotationCreatedToast && isMounted.current && isToastReady.current) {
      toast({
        title: `${
          annotationType === 'textspotting' ? 'Text' : 'Iconography'
        } annotation created`,
        description: 'Edit details in the sidebar',
      });
      setAnnotationCreatedToast(false);
    }
  }, [annotationCreatedToast, toast, annotationType]);

  useEffect(() => {
    if (annotationErrorToast && isMounted.current && isToastReady.current) {
      toast({
        title: 'Error',
        description: 'Failed to create annotation',
      });
      setAnnotationErrorToast(false);
    }
  }, [annotationErrorToast, toast]);

  useEffect(() => {
    if (showNotEnoughPointsToast && isMounted.current && isToastReady.current) {
      toast({
        title: 'Not enough points',
        description: 'At least 3 points are needed to create a polygon',
      });
      setShowNotEnoughPointsToast(false);
    }
  }, [showNotEnoughPointsToast, toast]);

  useEffect(() => {
    if (showUndoPointToast && isMounted.current && isToastReady.current) {
      toast({
        title: 'Point removed',
        description: 'Last point has been undone',
      });
      setShowUndoPointToast(false);
    }
  }, [showUndoPointToast, toast]);

  useEffect(() => {
    if (showEditStartToast && isMounted.current && isToastReady.current) {
      toast({
        title: 'Editing annotation',
        description:
          'Click to select points, drag to move them. Double-click on edges to add points. Delete key to remove selected points.',
      });
      setShowEditStartToast(false);
    }
  }, [showEditStartToast, toast]);

  useEffect(() => {
    if (showEditSaveToast && isMounted.current && isToastReady.current) {
      toast({
        title: 'Annotation updated',
        description: 'Changes saved successfully',
      });
      setShowEditSaveToast(false);
    }
  }, [showEditSaveToast, toast]);

  useEffect(() => {
    if (showEditCancelToast && isMounted.current && isToastReady.current) {
      toast({
        title: 'Edit cancelled',
        description: 'Changes discarded',
      });
      setShowEditCancelToast(false);
    }
  }, [showEditCancelToast, toast]);

  const closingLineRef = useRef<any>(null);

  const extractSvgPoints = (annotation: any): Array<[number, number]> => {
    const selector = annotation.target?.selector;
    let svgValue = '';

    if (selector?.type === 'SvgSelector') {
      svgValue = selector.value;
    } else if (Array.isArray(selector)) {
      const svgSelector = selector.find((s: any) => s.type === 'SvgSelector');
      if (svgSelector) svgValue = svgSelector.value;
    }

    if (!svgValue) return [];

    const match = svgValue.match(/<polygon points="([^"]+)"/);
    if (!match) return [];

    return match[1]
      .trim()
      .split(/\s+/)
      .map((pt) => {
        const [x, y] = pt.split(',').map(Number);
        return [x, y] as [number, number];
      });
  };

  const canEditAnnotation = (annotation: any) => {
    if (!annotation || !session?.user) return false;

    const selector = annotation.target?.selector;
    if (!selector) return false;

    let hasSvgSelector = false;
    if (selector.type === 'SvgSelector') {
      hasSvgSelector = true;
    } else if (Array.isArray(selector)) {
      hasSvgSelector = selector.some((s: any) => s.type === 'SvgSelector');
    }

    return hasSvgSelector;
  };

  const setupDrawingCanvas = () => {
    if (!viewer || drawingCanvasRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1000';

    const containerSize = viewer.viewport.containerSize;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = containerSize.x * dpr;
    canvas.height = containerSize.y * dpr;

    drawingCanvasRef.current = canvas;

    const viewerElement = viewer.element;
    viewerElement.appendChild(canvas);

    const ctx = canvas.getContext('2d', {
      willReadFrequently: false,
      alpha: true,
      desynchronized: true,
    });

    if (ctx) {
      ctx.scale(dpr, dpr);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(0.5, 0.5);

      ctx.clearRect(0, 0, containerSize.x, containerSize.y);
    }
  };

  const setupEditingOverlay = () => {
    if (!viewer || editingOverlayRef.current) return;

    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '1001';
    overlay.style.cursor = 'default';

    editingOverlayRef.current = overlay;

    const viewerElement = viewer.element;
    viewerElement.appendChild(overlay);
  };

  const clearDrawingCanvas = () => {
    if (!drawingCanvasRef.current) return;
    const ctx = drawingCanvasRef.current.getContext('2d');
    if (ctx) {
      const dpr = window.devicePixelRatio || 1;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(
        0,
        0,
        drawingCanvasRef.current.width,
        drawingCanvasRef.current.height,
      );
      ctx.restore();
    }
  };

  const drawPolygonWithPoints = (polygonPoints: Array<[number, number]>) => {
    if (
      !drawingCanvasRef.current ||
      !viewer ||
      !OpenSeadragon ||
      polygonPoints.length === 0
    )
      return;

    const canvas = drawingCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    clearDrawingCanvas();

    const canvasPoints = polygonPoints.map(([x, y]) => {
      try {
        const imagePoint = new OpenSeadragon.Point(x, y);
        const viewportPoint =
          viewer.viewport.imageToViewportCoordinates(imagePoint);
        const pixelPoint =
          viewer.viewport.viewportToViewerElementCoordinates(viewportPoint);

        const canvasX = Math.max(
          0,
          Math.min(canvas.width - 1, Math.round(pixelPoint.x)),
        );
        const canvasY = Math.max(
          0,
          Math.min(canvas.height - 1, Math.round(pixelPoint.y)),
        );

        return [canvasX, canvasY];
      } catch (error) {
        console.error('Error converting coordinates:', error);
        return [canvas.width / 2, canvas.height / 2];
      }
    });

    if (canvasPoints.length === 0) return;

    const primaryColor = 'hsl(165, 22%, 26%)';
    const secondaryColor = 'hsl(45, 64%, 59%)';
    const accentColor = 'hsl(22, 32%, 26%)';

    if (canvasPoints.length >= 3) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(canvasPoints[0][0], canvasPoints[0][1]);
      for (let i = 1; i < canvasPoints.length; i++) {
        ctx.lineTo(canvasPoints[i][0], canvasPoints[i][1]);
      }
      ctx.closePath();

      ctx.fillStyle = 'hsla(165, 22%, 26%, 0.15)';
      ctx.fill();

      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(
        canvasPoints[canvasPoints.length - 1][0],
        canvasPoints[canvasPoints.length - 1][1],
      );
      ctx.lineTo(canvasPoints[0][0], canvasPoints[0][1]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (canvasPoints.length >= 2) {
      ctx.save();
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(canvasPoints[0][0], canvasPoints[0][1]);
      for (let i = 1; i < canvasPoints.length; i++) {
        ctx.lineTo(canvasPoints[i][0], canvasPoints[i][1]);
      }
      ctx.stroke();
      ctx.restore();
    }

    canvasPoints.forEach(([x, y], index) => {
      const isFirst = index === 0;
      const radius = isFirst ? 5 : 4;

      ctx.save();

      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.fillStyle = isFirst ? secondaryColor : primaryColor;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.restore();
    });
  };

  const drawEditingPolygon = (polygonPoints: Array<[number, number]>) => {
    const currentState = {
      hoveredIndex: hoveredPointIndex,
      draggedIndex: draggedPointIndex,
      selectedIndex: selectedPointIndex,
    };

    const polygonChanged =
      JSON.stringify(polygonPoints) !==
      JSON.stringify(lastDrawnPolygonRef.current);
    const stateChanged =
      JSON.stringify(currentState) !==
      JSON.stringify(lastDrawnStateRef.current);

    const isFirstDraw = lastDrawnPolygonRef.current.length === 0;

    if (!polygonChanged && !stateChanged && !isFirstDraw) {
      return;
    }

    if (
      !drawingCanvasRef.current ||
      !viewer ||
      !OpenSeadragon ||
      polygonPoints.length === 0
    )
      return;

    lastDrawnPolygonRef.current = [...polygonPoints];
    lastDrawnStateRef.current = { ...currentState };

    const canvas = drawingCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    clearDrawingCanvas();

    const canvasPoints = polygonPoints.map(([x, y]) => {
      try {
        const imagePoint = new OpenSeadragon.Point(x, y);
        const viewportPoint =
          viewer.viewport.imageToViewportCoordinates(imagePoint);
        const pixelPoint =
          viewer.viewport.viewportToViewerElementCoordinates(viewportPoint);

        const canvasX = Math.max(
          0,
          Math.min(canvas.width - 1, Math.round(pixelPoint.x)),
        );
        const canvasY = Math.max(
          0,
          Math.min(canvas.height - 1, Math.round(pixelPoint.y)),
        );

        return [canvasX, canvasY];
      } catch (error) {
        console.error('Error converting coordinates:', error);
        return [canvas.width / 2, canvas.height / 2];
      }
    });

    if (canvasPoints.length === 0) return;

    const primaryColor = 'hsl(165, 22%, 26%)';
    const secondaryColor = 'hsl(45, 64%, 59%)';
    const editColor = 'hsl(45, 64%, 59%)';
    const hoverColor = 'hsl(0, 91%, 60%)';
    const midpointColor = 'hsl(22, 32%, 26%)';

    if (canvasPoints.length >= 3) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(canvasPoints[0][0], canvasPoints[0][1]);
      for (let i = 1; i < canvasPoints.length; i++) {
        ctx.lineTo(canvasPoints[i][0], canvasPoints[i][1]);
      }
      ctx.closePath();

      ctx.fillStyle = 'hsla(165, 22%, 26%, 0.15)';
      ctx.fill();

      const currentZoom = viewer.viewport.getZoom();
      const strokeWidth = Math.max(2, Math.min(currentZoom * 0.8, 5));

      ctx.strokeStyle = editColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    } else if (canvasPoints.length >= 2) {
      ctx.save();

      const currentZoom = viewer.viewport.getZoom();
      const strokeWidth = Math.max(2, Math.min(currentZoom * 0.8, 5));

      ctx.strokeStyle = editColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(canvasPoints[0][0], canvasPoints[0][1]);
      for (let i = 1; i < canvasPoints.length; i++) {
        ctx.lineTo(canvasPoints[i][0], canvasPoints[i][1]);
      }
      ctx.closePath();

      ctx.fillStyle = 'rgba(100, 180, 255, 0.1)';
      ctx.fill();

      ctx.stroke();
      ctx.restore();
    }

    canvasPoints.forEach(([x, y], index) => {
      const isHovered = index === hoveredPointIndex;
      const isDragged = index === draggedPointIndex;
      const isSelected = index === selectedPointIndex;

      const currentZoom = viewer.viewport.getZoom();
      const baseRadius = 2.2;
      const zoomFactor = Math.min(Math.max(Math.sqrt(currentZoom), 0.4), 1.8);
      const radius =
        isHovered || isDragged || isSelected
          ? baseRadius * zoomFactor * 1.2
          : baseRadius * zoomFactor;

      const color = isHovered
        ? hoverColor
        : isDragged
        ? editColor
        : isSelected
        ? primaryColor
        : primaryColor;

      ctx.save();

      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = Math.max(1.8, radius * 0.5);
      ctx.shadowOffsetX = Math.max(0.7, radius * 0.18);
      ctx.shadowOffsetY = Math.max(0.7, radius * 0.18);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.3, radius * 0.4);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.stroke();

      if (isHovered || isDragged || isSelected) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = Math.max(0.8, radius * 0.2);
        ctx.beginPath();
        ctx.arc(x, y, radius - 0.8, 0, 2 * Math.PI);
        ctx.stroke();
      }

      ctx.restore();
    });

    if (canvasPoints.length >= 2) {
      const currentZoom = viewer.viewport.getZoom();
      const zoomFactor = Math.min(Math.max(Math.sqrt(currentZoom), 0.5), 1.5);
      const midpointSize = 1.0 * zoomFactor;

      for (let i = 0; i < canvasPoints.length; i++) {
        const nextIndex = (i + 1) % canvasPoints.length;
        const midX = (canvasPoints[i][0] + canvasPoints[nextIndex][0]) / 2;
        const midY = (canvasPoints[i][1] + canvasPoints[nextIndex][1]) / 2;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = Math.max(1.0, midpointSize * 0.4);
        ctx.shadowOffsetX = 0.4;
        ctx.shadowOffsetY = 0.4;

        ctx.fillStyle = 'hsla(170, 70%, 55%, 0.7)';

        const offset = midpointSize;
        ctx.fillRect(midX - offset, midY - offset, offset * 2, offset * 2);

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(0.6, midpointSize * 0.25);
        ctx.strokeRect(midX - offset, midY - offset, offset * 2, offset * 2);
        ctx.restore();
      }
    }
  };

  const drawPolygonOnCanvas = () => {
    drawPolygonWithPoints(currentPolygon);
  };

  const throttledDrawEditingPolygon = useCallback(
    (polygonPoints: Array<[number, number]>) => {
      const now = performance.now();

      if (drawThrottleRef.current) {
        cancelAnimationFrame(drawThrottleRef.current);
      }

      const timeSinceLastDraw = now - lastDrawCallRef.current;

      const throttleThreshold = isDragging ? 32 : 16;

      if (timeSinceLastDraw < throttleThreshold) {
        drawThrottleRef.current = requestAnimationFrame(() => {
          if (isMounted.current) {
            drawEditingPolygon(polygonPoints);
            lastDrawCallRef.current = performance.now();
          }
        });
      } else {
        drawEditingPolygon(polygonPoints);
        lastDrawCallRef.current = now;
      }
    },
    [isDragging],
  );

  const transformToCanvasCoordinates = useCallback(
    (imageX: number, imageY: number) => {
      if (!viewer || !OpenSeadragon || !drawingCanvasRef.current) return null;

      const currentZoom = viewer.viewport.getZoom();
      const currentCenter = viewer.viewport.getCenter();

      const zoomKey = Math.floor(currentZoom * 100) / 100;
      const centerXKey = Math.floor(currentCenter.x * 100) / 100;
      const centerYKey = Math.floor(currentCenter.y * 100) / 100;

      const cacheKey = `${imageX}:${imageY}:${zoomKey}:${centerXKey}:${centerYKey}`;

      if (coordinatesCacheRef.current.has(cacheKey)) {
        return coordinatesCacheRef.current.get(cacheKey)!;
      }

      try {
        const imagePoint = new OpenSeadragon.Point(imageX, imageY);
        const viewportPoint =
          viewer.viewport.imageToViewportCoordinates(imagePoint);
        const pixelPoint =
          viewer.viewport.viewportToViewerElementCoordinates(viewportPoint);

        const result = {
          x: Math.round(pixelPoint.x),
          y: Math.round(pixelPoint.y),
        };

        if (coordinatesCacheRef.current.size > 2000) {
          const entries = Array.from(coordinatesCacheRef.current.entries());
          coordinatesCacheRef.current = new Map(entries.slice(-500));
        }

        coordinatesCacheRef.current.set(cacheKey, result);
        return result;
      } catch (error) {
        console.error('Error transforming coordinates:', error);
        return null;
      }
    },
    [viewer, OpenSeadragon],
  );

  const getPointIndexAtPosition = (
    viewportX: number,
    viewportY: number,
  ): number | null => {
    if (!viewer || !OpenSeadragon) return null;

    const currentZoom = viewer.viewport.getZoom();
    const baseTolerance = 20;
    const minTolerance = 10;
    const maxTolerance = 30;

    const tolerance = Math.min(
      Math.max(baseTolerance / Math.pow(currentZoom, 0.4), minTolerance),
      maxTolerance,
    );

    let closestPointIndex = null;
    let minDistance = Infinity;

    const toleranceSquared = tolerance * tolerance;

    for (let i = 0; i < editingPolygon.length; i++) {
      const [x, y] = editingPolygon[i];
      const canvasPoint = transformToCanvasCoordinates(x, y);
      if (!canvasPoint) continue;

      const distanceSquared =
        Math.pow(canvasPoint.x - viewportX, 2) +
        Math.pow(canvasPoint.y - viewportY, 2);

      if (
        distanceSquared <= toleranceSquared &&
        distanceSquared < minDistance
      ) {
        minDistance = distanceSquared;
        closestPointIndex = i;
      }
    }

    return closestPointIndex;
  };

  const getEdgeIndexAtPosition = (
    viewportX: number,
    viewportY: number,
  ): number | null => {
    if (!viewer || !OpenSeadragon) return null;

    const currentZoom = viewer.viewport.getZoom();
    const baseTolerance = 20;
    const minTolerance = 12;
    const maxTolerance = 30;

    const tolerance = Math.min(
      Math.max(baseTolerance / Math.pow(currentZoom, 0.4), minTolerance),
      maxTolerance,
    );

    let closestEdgeIndex = null;
    let minDistance = Infinity;

    const toleranceSquared = tolerance * tolerance;

    for (let i = 0; i < editingPolygon.length; i++) {
      const nextIndex = (i + 1) % editingPolygon.length;
      const [x1, y1] = editingPolygon[i];
      const [x2, y2] = editingPolygon[nextIndex];

      const canvasPoint1 = transformToCanvasCoordinates(x1, y1);
      const canvasPoint2 = transformToCanvasCoordinates(x2, y2);

      if (!canvasPoint1 || !canvasPoint2) continue;

      const midX = (canvasPoint1.x + canvasPoint2.x) / 2;
      const midY = (canvasPoint1.y + canvasPoint2.y) / 2;

      const distanceSquared =
        Math.pow(midX - viewportX, 2) + Math.pow(midY - viewportY, 2);

      if (
        distanceSquared <= toleranceSquared &&
        distanceSquared < minDistance
      ) {
        minDistance = distanceSquared;
        closestEdgeIndex = i;
      }
    }

    return closestEdgeIndex;
  };

  const undoLastPoint = () => {
    if (currentPolygon.length === 0) return;

    const newPolygon = currentPolygon.slice(0, -1);
    setCurrentPolygon(newPolygon);

    drawPolygonWithPoints(newPolygon);

    setTimeout(() => {
      if (isMounted.current && isToastReady.current) {
        setShowUndoPointToast(true);
      }
    }, 50);
  };

  const updateClosingLine = () => {
    drawPolygonOnCanvas();
  };

  const updatePolygonOverlay = () => {
    drawPolygonOnCanvas();
  };

  const startEditing = () => {
    if (!viewer || !selectedAnnotation || !session?.user) return;

    clearOverlays();
    setIsEditing(false);
    setEditingPolygon([]);
    setEditingAnnotation(null);
    setHoveredPointIndex(null);
    setDraggedPointIndex(null);
    setSelectedPointIndex(null);

    const points = extractSvgPoints(selectedAnnotation);

    if (points.length === 0) {
      return;
    }

    setIsEditing(true);
    setEditingPolygon(points);
    setEditingAnnotation(selectedAnnotation);

    lastDrawnPolygonRef.current = [];
    lastDrawnStateRef.current = {
      hoveredIndex: null,
      draggedIndex: null,
      selectedIndex: null,
    };
    coordinatesCacheRef.current.clear();

    setTimeout(() => {
      setupDrawingCanvas();
      setupEditingOverlay();
      requestAnimationFrame(() => {
        drawEditingPolygon(points);
        lastDrawCallRef.current = performance.now();
      });
    }, 10);

    setTimeout(() => {
      if (isMounted.current && isToastReady.current) {
        setShowEditStartToast(true);
      }
    }, 100);
  };
  const cancelEditing = () => {
    if (drawThrottleRef.current) {
      cancelAnimationFrame(drawThrottleRef.current);
      drawThrottleRef.current = null;
    }

    setIsEditing(false);
    setEditingPolygon([]);
    setEditingAnnotation(null);
    setHoveredPointIndex(null);
    setDraggedPointIndex(null);
    setSelectedPointIndex(null);
    setIsDragging(false);
    setDragStartPos(null);

    if (drawingCanvasRef.current) {
      drawingCanvasRef.current.style.pointerEvents = 'none';
      drawingCanvasRef.current.style.backgroundColor = 'transparent';
      drawingCanvasRef.current.style.touchAction = '';
      drawingCanvasRef.current.style.cursor = 'default';
    }

    clearOverlays();

    setTimeout(() => {
      if (isMounted.current && isToastReady.current) {
        setShowEditCancelToast(true);
      }
    }, 150);
  };

  const finishEditing = async () => {
    if (!editingAnnotation || editingPolygon.length < 3) return;

    if (drawThrottleRef.current) {
      cancelAnimationFrame(drawThrottleRef.current);
      drawThrottleRef.current = null;
    }

    try {
      const svgString = `<svg xmlns="http://www.w3.org/2000/svg"><polygon points="${editingPolygon
        .map((point) => `${point[0]},${point[1]}`)
        .join(' ')}"/></svg>`;

      const isIconography = editingAnnotation.motivation === 'iconography';
      const currentTimestamp = new Date().toISOString();

      const originalCreated = editingAnnotation.created;
      const finalModifiedTime =
        originalCreated &&
        new Date(currentTimestamp) < new Date(originalCreated)
          ? originalCreated
          : currentTimestamp;

      if (
        originalCreated &&
        new Date(currentTimestamp) < new Date(originalCreated)
      ) {
        console.warn(
          `Timestamp adjustment for annotation ${editingAnnotation.id}: current time ${currentTimestamp} is before created time ${originalCreated}, using created time as modified time`,
        );
      }

      const updatedAnnotation = {
        ...editingAnnotation,
        target: {
          ...editingAnnotation.target,
          selector: {
            type: 'SvgSelector',
            value: svgString,
          },
        },
        modified: finalModifiedTime,
        ...(isIconography
          ? {
              body: [],
              creator:
                editingAnnotation.creator ||
                (session?.user
                  ? {
                      id: `https://orcid.org/${
                        (session.user as any)?.id || '0000-0000-0000-0000'
                      }`,
                      type: 'Person',
                      label:
                        (session.user as any)?.label ||
                        session.user?.name ||
                        'Unknown User',
                    }
                  : undefined),
            }
          : {}),
      };

      onAnnotationUpdate?.(updatedAnnotation);

      setIsEditing(false);
      setEditingPolygon([]);
      setEditingAnnotation(null);
      setHoveredPointIndex(null);
      setDraggedPointIndex(null);
      setSelectedPointIndex(null);
      if (drawingCanvasRef.current) {
        drawingCanvasRef.current.style.pointerEvents = 'none';
        drawingCanvasRef.current.style.backgroundColor = 'transparent';
        drawingCanvasRef.current.style.touchAction = '';
        drawingCanvasRef.current.style.cursor = 'default';
      }

      clearOverlays();

      setTimeout(() => {
        if (isMounted.current && isToastReady.current) {
          setShowEditSaveToast(true);
        }
      }, 150);
    } catch (error) {
      console.error('Error saving annotation:', error);
    }
  };

  useEffect(() => {
    if (!viewer || !isVisible || !OpenSeadragon) return;

    if (isDrawing) {
      setupDrawingCanvas();

      mouseDownHandlerRef.current = (event: any) => {
        const webPoint = event.position;
        setDragStartPos({ x: webPoint.x, y: webPoint.y });
        setIsDragging(false);
      };

      mouseMoveHandlerRef.current = (event: any) => {
        if (dragStartPos) {
          const webPoint = event.position;
          const dragDistance = Math.sqrt(
            Math.pow(webPoint.x - dragStartPos.x, 2) +
              Math.pow(webPoint.y - dragStartPos.y, 2),
          );

          if (dragDistance > 5) {
            setIsDragging(true);
          }
        }
      };

      mouseUpHandlerRef.current = (event: any) => {
        setTimeout(() => {
          setDragStartPos(null);
          setIsDragging(false);
        }, 10);
      };

      clickHandlerRef.current = (event: any) => {
        if (!OpenSeadragon) return;

        if (event.originalEvent && event.originalEvent.detail > 1) {
          return;
        }

        if (isDragging) {
          return;
        }

        const webPoint = event.position;
        const viewportPoint = viewer.viewport.pointFromPixel(webPoint);
        const imagePoint =
          viewer.viewport.viewportToImageCoordinates(viewportPoint);

        const x = Math.round(imagePoint.x);
        const y = Math.round(imagePoint.y);

        if (currentPolygon.length > 0) {
          const lastPoint = currentPolygon[currentPolygon.length - 1];
          const distance = Math.sqrt(
            Math.pow(x - lastPoint[0], 2) + Math.pow(y - lastPoint[1], 2),
          );
          if (distance < 5) {
            return;
          }
        }

        const newPolygon = [...currentPolygon, [x, y] as [number, number]];
        setCurrentPolygon(newPolygon);

        drawPolygonWithPoints(newPolygon);
      };

      keyHandlerRef.current = (event: KeyboardEvent) => {
        if (!isDrawing) return;

        if (event.key === 'Escape') {
          event.preventDefault();
          cancelDrawing();
        } else if (event.key === 'Backspace' || event.key === 'Delete') {
          event.preventDefault();
          if (currentPolygon.length > 0) {
            undoLastPoint();
          }
        } else if (event.key === 'Enter') {
          event.preventDefault();
          if (currentPolygon.length >= 3) {
            finishDrawing();
          }
        }
      };

      dblClickHandlerRef.current = (event: any) => {
        if (currentPolygon.length >= 3) {
          event.preventDefaultAction = true;
          finishDrawing();
        } else {
          setTimeout(() => {
            if (isMounted.current && isToastReady.current) {
              setShowNotEnoughPointsToast(true);
            }
          }, 100);
        }
      };

      viewer.addHandler('canvas-press', mouseDownHandlerRef.current);
      viewer.addHandler('canvas-drag', mouseMoveHandlerRef.current);
      viewer.addHandler('canvas-release', mouseUpHandlerRef.current);
      viewer.addHandler('canvas-click', clickHandlerRef.current);
      viewer.addHandler('canvas-double-click', dblClickHandlerRef.current);

      document.addEventListener('keydown', keyHandlerRef.current);

      return () => {
        if (mouseDownHandlerRef.current) {
          viewer.removeHandler('canvas-press', mouseDownHandlerRef.current);
        }
        if (mouseMoveHandlerRef.current) {
          viewer.removeHandler('canvas-drag', mouseMoveHandlerRef.current);
        }
        if (mouseUpHandlerRef.current) {
          viewer.removeHandler('canvas-release', mouseUpHandlerRef.current);
        }
        if (clickHandlerRef.current) {
          viewer.removeHandler('canvas-click', clickHandlerRef.current);
        }
        if (dblClickHandlerRef.current) {
          viewer.removeHandler(
            'canvas-double-click',
            dblClickHandlerRef.current,
          );
        }
        if (keyHandlerRef.current) {
          document.removeEventListener('keydown', keyHandlerRef.current);
        }
      };
    } else if (isEditing) {
      setupDrawingCanvas();
      setupEditingOverlay();

      if (editingOverlayRef.current) {
        editingOverlayRef.current.style.pointerEvents = 'auto';
      }

      const handleMouseMove = (event: MouseEvent) => {
        if (!editingOverlayRef.current) return;

        event.preventDefault();
        event.stopPropagation();

        const rect = editingOverlayRef.current.getBoundingClientRect();
        const viewportX = event.clientX - rect.left;
        const viewportY = event.clientY - rect.top;

        if (draggedPointIndex !== null && dragStartPos) {
          const dragDistance = Math.sqrt(
            Math.pow(viewportX - dragStartPos.x, 2) +
              Math.pow(viewportY - dragStartPos.y, 2),
          );

          if (dragDistance > 3) {
            setIsDragging(true);

            const viewportPoint = viewer.viewport.pointFromPixel(
              new OpenSeadragon.Point(viewportX, viewportY),
            );
            const imagePoint =
              viewer.viewport.viewportToImageCoordinates(viewportPoint);

            const newPolygon = [...editingPolygon];
            newPolygon[draggedPointIndex] = [
              Math.round(imagePoint.x),
              Math.round(imagePoint.y),
            ];

            setEditingPolygon(newPolygon);
            throttledDrawEditingPolygon(newPolygon);
          }
        } else {
          const pointIndex = getPointIndexAtPosition(viewportX, viewportY);
          const edgeIndex =
            pointIndex === null
              ? getEdgeIndexAtPosition(viewportX, viewportY)
              : null;

          if (pointIndex !== hoveredPointIndex) {
            setHoveredPointIndex(pointIndex);
            if (editingPolygon.length > 0) {
              requestAnimationFrame(() => {
                throttledDrawEditingPolygon(editingPolygon);
              });
            }
          }

          if (editingOverlayRef.current) {
            let newCursor = 'default';
            if (pointIndex !== null) {
              newCursor = 'grab';
            } else if (edgeIndex !== null) {
              newCursor = 'pointer';
            }

            if (editingOverlayRef.current.style.cursor !== newCursor) {
              editingOverlayRef.current.style.cursor = newCursor;
            }
          }
        }
      };

      const handleMouseDown = (event: MouseEvent) => {
        if (!editingOverlayRef.current) return;

        event.preventDefault();
        event.stopPropagation();

        const rect = editingOverlayRef.current.getBoundingClientRect();
        const viewportX = event.clientX - rect.left;
        const viewportY = event.clientY - rect.top;

        const pointIndex = getPointIndexAtPosition(viewportX, viewportY);

        if (pointIndex !== null) {
          setSelectedPointIndex(pointIndex);
          setDraggedPointIndex(pointIndex);
          setDragStartPos({ x: viewportX, y: viewportY });
          setIsDragging(false);

          if (editingPolygon.length > 0) {
            requestAnimationFrame(() => {
              throttledDrawEditingPolygon(editingPolygon);
            });
          }

          if (editingOverlayRef.current) {
            editingOverlayRef.current.style.cursor = 'grabbing';
          }
        } else {
          setSelectedPointIndex(null);

          if (editingPolygon.length > 0) {
            requestAnimationFrame(() => {
              throttledDrawEditingPolygon(editingPolygon);
            });
          }
        }
      };

      const handleMouseUp = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        if (draggedPointIndex !== null) {
          if (editingOverlayRef.current) {
            const rect = editingOverlayRef.current.getBoundingClientRect();
            const viewportX = event.clientX - rect.left;
            const viewportY = event.clientY - rect.top;

            const pointIndex = getPointIndexAtPosition(viewportX, viewportY);
            const edgeIndex = getEdgeIndexAtPosition(viewportX, viewportY);

            if (pointIndex !== null) {
              editingOverlayRef.current.style.cursor = 'grab'; // Changed from crosshair to grab
            } else if (edgeIndex !== null) {
              editingOverlayRef.current.style.cursor = 'pointer'; // Changed from cell to pointer
            } else {
              editingOverlayRef.current.style.cursor = 'default';
            }
          }
        }

        setDraggedPointIndex(null);
        setDragStartPos(null);
        setIsDragging(false);
      };

      const handleDoubleClick = (event: MouseEvent) => {
        if (!editingOverlayRef.current) return;

        event.preventDefault();
        event.stopPropagation();

        const rect = editingOverlayRef.current.getBoundingClientRect();
        const viewportX = event.clientX - rect.left;
        const viewportY = event.clientY - rect.top;

        const edgeIndex = getEdgeIndexAtPosition(viewportX, viewportY);

        if (edgeIndex !== null) {
          const nextIndex = (edgeIndex + 1) % editingPolygon.length;
          const [x1, y1] = editingPolygon[edgeIndex];
          const [x2, y2] = editingPolygon[nextIndex];

          const newX = Math.round((x1 + x2) / 2);
          const newY = Math.round((y1 + y2) / 2);

          const newPolygon = [...editingPolygon];
          newPolygon.splice(nextIndex, 0, [newX, newY]);
          setEditingPolygon(newPolygon);

          setSelectedPointIndex(null);

          throttledDrawEditingPolygon(newPolygon);
        }
      };

      if (editingOverlayRef.current) {
        editingOverlayRef.current.addEventListener(
          'mousemove',
          handleMouseMove,
        );
        editingOverlayRef.current.addEventListener(
          'mousedown',
          handleMouseDown,
        );
        editingOverlayRef.current.addEventListener('mouseup', handleMouseUp);
        editingOverlayRef.current.addEventListener(
          'dblclick',
          handleDoubleClick,
        );
      }

      keyHandlerRef.current = (event: KeyboardEvent) => {
        if (!isEditing) return;

        if (event.key === 'Escape') {
          event.preventDefault();
          cancelEditing();
        } else if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
          if (selectedPointIndex !== null && editingPolygon.length > 3) {
            const newPolygon = editingPolygon.filter(
              (_, index) => index !== selectedPointIndex,
            );
            setEditingPolygon(newPolygon);
            setSelectedPointIndex(null);
            setHoveredPointIndex(null);
            requestAnimationFrame(() => {
              throttledDrawEditingPolygon(newPolygon);
            });
          }
        } else if (event.key === 'Enter') {
          event.preventDefault();
          finishEditing();
        }
      };

      document.addEventListener('keydown', keyHandlerRef.current);

      return () => {
        if (editingOverlayRef.current) {
          editingOverlayRef.current.removeEventListener(
            'mousemove',
            handleMouseMove,
          );
          editingOverlayRef.current.removeEventListener(
            'mousedown',
            handleMouseDown,
          );
          editingOverlayRef.current.removeEventListener(
            'mouseup',
            handleMouseUp,
          );
          editingOverlayRef.current.removeEventListener(
            'dblclick',
            handleDoubleClick,
          );
        }

        if (keyHandlerRef.current) {
          document.removeEventListener('keydown', keyHandlerRef.current);
        }
      };
    }
  }, [
    viewer,
    isDrawing,
    isEditing,
    isVisible,
    currentPolygon,
    editingPolygon,
    hoveredPointIndex,
    draggedPointIndex,
    isDragging,
    dragStartPos,
    toast,
    updateClosingLine,
    updatePolygonOverlay,
    OpenSeadragon,
  ]);

  useEffect(() => {
    if (isDrawing && drawingCanvasRef.current && currentPolygon.length > 0) {
      drawPolygonOnCanvas();
    }
  }, [currentPolygon, isDrawing]);

  useEffect(() => {
    if (isEditing && editingPolygon.length > 0 && drawingCanvasRef.current) {
      drawEditingPolygon(editingPolygon);
    }
  }, [
    isEditing,
    editingPolygon,
    hoveredPointIndex,
    draggedPointIndex,
    selectedPointIndex,
  ]);

  useEffect(() => {
    if (!viewer || (!isDrawing && !isEditing)) return;

    let lastUpdateTime = 0;
    let rafId: number;
    let isAnimating = false;
    let pendingUpdate = false;

    const handleViewportChange = () => {
      const now = performance.now();

      const frameThreshold = isAnimating ? 50 : 16;
      if (now - lastUpdateTime < frameThreshold) {
        if (!pendingUpdate) {
          pendingUpdate = true;
          setTimeout(() => {
            pendingUpdate = false;
            if (isMounted.current) {
              handleViewportChange();
            }
          }, frameThreshold);
        }
        return;
      }

      lastUpdateTime = now;

      const currentZoom = viewer.viewport.getZoom();
      const currentCenter = viewer.viewport.getCenter();

      if (lastViewportStateRef.current) {
        const zoomDiff = Math.abs(
          currentZoom - lastViewportStateRef.current.zoom,
        );
        const centerDiff =
          Math.abs(currentCenter.x - lastViewportStateRef.current.center.x) +
          Math.abs(currentCenter.y - lastViewportStateRef.current.center.y);

        if (zoomDiff > 0.05 || centerDiff > 0.005) {
          if (coordinatesCacheRef.current.size > 100) {
            const entries = Array.from(coordinatesCacheRef.current.entries());
            coordinatesCacheRef.current = new Map(entries.slice(-100));
          }

          isAnimating = true;
          setTimeout(() => {
            isAnimating = false;
          }, 300);
        }
      }

      lastViewportStateRef.current = {
        zoom: currentZoom,
        center: currentCenter,
      };

      if (drawingCanvasRef.current) {
        const containerSize = viewer.viewport.containerSize;
        const canvas = drawingCanvasRef.current;

        let sizeChanged = false;
        if (
          canvas.width !== containerSize.x ||
          canvas.height !== containerSize.y
        ) {
          canvas.width = containerSize.x;
          canvas.height = containerSize.y;
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          sizeChanged = true;
        }

        if (sizeChanged || isDrawing || isEditing) {
          if (rafId) {
            cancelAnimationFrame(rafId);
          }

          rafId = requestAnimationFrame(() => {
            if (!isMounted.current) return;

            if (isDrawing && currentPolygon.length > 0) {
              drawPolygonOnCanvas();
            } else if (isEditing && editingPolygon.length > 0) {
              drawEditingPolygon(editingPolygon);
            }
          });
        }
      }
    };

    viewer.addHandler('pan', handleViewportChange);
    viewer.addHandler('zoom', handleViewportChange);
    viewer.addHandler('animation', handleViewportChange);
    viewer.addHandler('resize', handleViewportChange);
    viewer.addHandler('viewport-change', handleViewportChange);

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      viewer.removeHandler('pan', handleViewportChange);
      viewer.removeHandler('zoom', handleViewportChange);
      viewer.removeHandler('animation', handleViewportChange);
      viewer.removeHandler('resize', handleViewportChange);
      viewer.removeHandler('viewport-change', handleViewportChange);
    };
  }, [viewer, isDrawing, isEditing, currentPolygon, editingPolygon]);

  useEffect(() => {
    if (
      !viewer ||
      (!isDrawing && !isEditing) ||
      (isDrawing && currentPolygon.length === 0) ||
      (isEditing && editingPolygon.length === 0)
    )
      return;

    let animationId: number;
    let isTracking = true;
    let lastRender = performance.now();

    const smoothTrack = (currentTime: number) => {
      if (!isTracking) return;

      if (currentTime - lastRender >= 16.67) {
        if (drawingCanvasRef.current) {
          if (isDrawing && currentPolygon.length > 0) {
            drawPolygonOnCanvas();
          } else if (isEditing && editingPolygon.length > 0 && !isDragging) {
            drawEditingPolygon(editingPolygon);
          }
        }
        lastRender = currentTime;
      }

      if (isDrawing || isEditing) {
        animationId = requestAnimationFrame(smoothTrack);
      }
    };

    animationId = requestAnimationFrame(smoothTrack);

    return () => {
      isTracking = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [
    viewer,
    isDrawing,
    isEditing,
    currentPolygon.length,
    editingPolygon.length,
    isDragging,
  ]);

  useEffect(() => {
    if (showDrawingStartToast && isMounted.current && isToastReady.current) {
      toast({
        title: `Creating new ${
          annotationType === 'textspotting' ? 'text' : 'iconography'
        } annotation`,
        description:
          'Click to add points. Double-click or Enter to finish. Backspace/Delete to undo. Esc to cancel.',
      });
      setShowDrawingStartToast(false);
    }
  }, [showDrawingStartToast, toast, annotationType]);

  const startDrawing = () => {
    if (!viewer) return;
    if (!session?.user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to create annotations',
      });
      return;
    }

    setIsDrawing(true);
    setCurrentPolygon([]);
    clearOverlays();

    setTimeout(() => {
      setupDrawingCanvas();
    }, 10);

    setTimeout(() => {
      if (isMounted.current && isToastReady.current) {
        setShowDrawingStartToast(true);
      }
    }, 100);
  };

  const clearOverlays = () => {
    if (!viewer) return;

    pointOverlaysRef.current.forEach((overlay) => {
      try {
        viewer.removeOverlay(overlay);
      } catch (e) {
        console.error('Failed to remove point overlay', e);
      }
    });
    pointOverlaysRef.current = [];

    lineOverlaysRef.current.forEach((overlay) => {
      try {
        viewer.removeOverlay(overlay);
      } catch (e) {
        console.error('Failed to remove line overlay', e);
      }
    });
    lineOverlaysRef.current = [];

    if (closingLineRef.current) {
      try {
        viewer.removeOverlay(closingLineRef.current);
        closingLineRef.current = null;
      } catch (e) {
        console.error('Failed to remove closing line overlay', e);
      }
    }

    if (polygonOverlayRef.current) {
      try {
        viewer.removeOverlay(polygonOverlayRef.current);
        polygonOverlayRef.current = null;
      } catch (e) {
        console.error('Failed to remove polygon overlay', e);
      }
    }
    if (drawingCanvasRef.current) {
      try {
        const canvas = drawingCanvasRef.current;

        if (canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
        drawingCanvasRef.current = null;
      } catch (e) {
        console.error('Failed to remove drawing canvas', e);
      }
    }

    if (editingOverlayRef.current) {
      try {
        const overlay = editingOverlayRef.current;
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        editingOverlayRef.current = null;
      } catch (e) {
        console.error('Failed to remove editing overlay', e);
      }
    }

    if (drawingOverlayRef.current) {
      try {
        viewer.removeOverlay(drawingOverlayRef.current);
        drawingOverlayRef.current = null;
      } catch (e) {
        console.error('Failed to remove drawing overlay', e);
      }
    }
  };

  useEffect(() => {
    if (showCancelToast && isMounted.current && isToastReady.current) {
      toast({
        title: 'Drawing cancelled',
        description: 'Drawing mode deactivated',
      });
      setShowCancelToast(false);
    }
  }, [showCancelToast, toast]);

  const cancelDrawing = () => {
    if (!viewer) return;

    viewportStateRef.current = {
      center: viewer.viewport.getCenter(),
      zoom: viewer.viewport.getZoom(),
      bounds: viewer.viewport.getBounds(),
    };

    setIsDrawing(false);
    setCurrentPolygon([]);
    setIsDragging(false);
    setDragStartPos(null);

    clearOverlays();

    setTimeout(() => {
      if (viewer && viewportStateRef.current) {
        viewer.viewport.panTo(viewportStateRef.current.center, null, false);
        viewer.viewport.zoomTo(
          viewportStateRef.current.zoom,
          viewportStateRef.current.center,
          false,
        );
        viewportStateRef.current = null;
      }
    }, 100);

    setTimeout(() => {
      if (isMounted.current && isToastReady.current) {
        setShowCancelToast(true);
      }
    }, 150);
  };

  const finishDrawing = async () => {
    if (!viewer || !canvasId) return;

    viewportStateRef.current = {
      center: viewer.viewport.getCenter(),
      zoom: viewer.viewport.getZoom(),
      bounds: viewer.viewport.getBounds(),
    };

    setIsDrawing(false);
    setIsDragging(false);
    setDragStartPos(null);

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg"><polygon points="${currentPolygon
      .map((point) => `${point[0]},${point[1]}`)
      .join(' ')}"/></svg>`;

    const currentTimestamp = new Date().toISOString();

    const newAnnotation = {
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      type: 'Annotation',
      motivation: annotationType,
      body:
        annotationType === 'iconography'
          ? []
          : [
              {
                type: 'TextualBody',
                value: '',
                format: 'text/plain',
                purpose: 'supplementing',
                creator: session?.user
                  ? {
                      id: `https://orcid.org/${
                        (session.user as any)?.id || '0000-0000-0000-0000'
                      }`,
                      type: 'Person',
                      label:
                        (session.user as any)?.label ||
                        session.user?.name ||
                        'Unknown User',
                    }
                  : undefined,
                created: currentTimestamp,
                modified: currentTimestamp,
              },
            ],
      ...(annotationType === 'iconography' && session?.user
        ? {
            creator: {
              id: `https://orcid.org/${
                (session.user as any)?.id || '0000-0000-0000-0000'
              }`,
              type: 'Person',
              label:
                (session.user as any)?.label ||
                session.user?.name ||
                'Unknown User',
            },
            created: currentTimestamp,
            modified: currentTimestamp,
          }
        : {}),
      target: {
        source: canvasId,
        selector: {
          type: 'SvgSelector',
          value: svgString,
        },
      },
    };

    try {
      const response = await fetch('/api/annotations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newAnnotation),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const savedAnnotation = await response.json();

      onNewAnnotation(savedAnnotation);

      clearOverlays();

      setTimeout(() => {
        if (viewer && viewportStateRef.current) {
          viewer.viewport.panTo(viewportStateRef.current.center, null, false);
          viewer.viewport.zoomTo(
            viewportStateRef.current.zoom,
            viewportStateRef.current.center,
            false,
          );
          viewportStateRef.current = null;
        }
      }, 100);

      setTimeout(() => {
        if (isMounted.current && isToastReady.current) {
          setAnnotationCreatedToast(true);
        }
      }, 150);
    } catch (error) {
      console.error('Error creating annotation:', error);

      setTimeout(() => {
        if (viewer && viewportStateRef.current) {
          viewer.viewport.panTo(viewportStateRef.current.center, null, false);
          viewer.viewport.zoomTo(
            viewportStateRef.current.zoom,
            viewportStateRef.current.center,
            false,
          );
          viewportStateRef.current = null;
        }
      }, 100);

      setTimeout(() => {
        if (isMounted.current && isToastReady.current) {
          setAnnotationErrorToast(true);
        }
      }, 150);
    }
  };

  if (!isVisible) return null;

  const canEdit = session?.user;
  const showEditButton =
    canEdit &&
    selectedAnnotation &&
    canEditAnnotation(selectedAnnotation) &&
    !isDrawing &&
    !isEditing;

  return (
    <div className="absolute top-2 right-2 z-[9999] flex gap-2">
      {!isDrawing && !isEditing ? (
        <>
          {showEditButton && (
            <Button
              size="sm"
              onClick={startEditing}
              className="relative p-2 text-white hover:bg-accent/90"
              title="Edit annotation points"
            >
              <SquareDashed className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              setAnnotationType('textspotting');
              startDrawing();
            }}
            disabled={!canEdit}
            className={`relative p-2 bg-white text-gray-700 border hover:bg-gray-100 ${
              !canEdit ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title={
              canEdit
                ? 'Draw new text annotation'
                : 'Sign in to create text annotations'
            }
          >
            <Type className="h-4 w-4" />
            <Pen className="h-2.5 w-2.5 absolute bottom-0 right-0 text-current" />
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setAnnotationType('iconography');
              startDrawing();
            }}
            disabled={!canEdit}
            className={`relative p-2 bg-white text-gray-700 border hover:bg-gray-100 ${
              !canEdit ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title={
              canEdit
                ? 'Draw new iconography annotation'
                : 'Sign in to create iconography annotations'
            }
          >
            <Image className="h-4 w-4" />
            <Pen className="h-2.5 w-2.5 absolute bottom-0 right-0 text-current" />
          </Button>
        </>
      ) : isEditing ? (
        <>
          <Button
            size="sm"
            onClick={finishEditing}
            disabled={editingPolygon.length < 3}
            className="bg-primary text-primary-foreground hover:bg-primary/90 p-2"
            title="Save changes (Enter)"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={cancelEditing}
            variant="destructive"
            className="p-2"
            title="Cancel editing (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <Button
            size="sm"
            onClick={finishDrawing}
            disabled={currentPolygon.length < 3}
            className="bg-primary text-primary-foreground hover:bg-primary/90 p-2"
            title="Finish drawing annotation (Enter)"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={undoLastPoint}
            disabled={currentPolygon.length === 0}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90 p-2"
            title="Undo last point (Backspace/Delete)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={cancelDrawing}
            variant="destructive"
            className="p-2"
            title="Cancel drawing (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
