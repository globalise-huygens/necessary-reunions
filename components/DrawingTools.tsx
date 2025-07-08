'use client';

import { useToast } from '@/hooks/use-toast';
import { Check, Image, Pen, Type, Undo2, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from './Button';

let OpenSeadragon: any;

interface DrawingToolsProps {
  viewer: any | null;
  canvasId: string;
  isVisible: boolean;
  onNewAnnotation: (annotation: any) => void;
  onDrawingStateChange?: (isDrawing: boolean) => void;
}

export function DrawingTools({
  viewer,
  canvasId,
  isVisible,
  onNewAnnotation,
  onDrawingStateChange,
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

  const [annotationCreatedToast, setAnnotationCreatedToast] = useState(false);
  const [annotationErrorToast, setAnnotationErrorToast] = useState(false);
  const [showDrawingStartToast, setShowDrawingStartToast] = useState(false);
  const [showCancelToast, setShowCancelToast] = useState(false);
  const [showNotEnoughPointsToast, setShowNotEnoughPointsToast] =
    useState(false);
  const [showUndoPointToast, setShowUndoPointToast] = useState(false);

  const pointOverlaysRef = useRef<any[]>([]);
  const lineOverlaysRef = useRef<any[]>([]);
  const clickHandlerRef = useRef<((event: any) => void) | null>(null);
  const dblClickHandlerRef = useRef<((event: any) => void) | null>(null);
  const keyHandlerRef = useRef<((event: any) => void) | null>(null);
  const mouseDownHandlerRef = useRef<((event: any) => void) | null>(null);
  const mouseMoveHandlerRef = useRef<((event: any) => void) | null>(null);
  const mouseUpHandlerRef = useRef<((event: any) => void) | null>(null);
  const polygonOverlayRef = useRef<any>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
    onDrawingStateChange?.(isDrawing);
  }, [isDrawing, onDrawingStateChange]);

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

  const closingLineRef = useRef<any>(null);

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
    canvas.width = containerSize.x;
    canvas.height = containerSize.y;

    drawingCanvasRef.current = canvas;

    const viewerElement = viewer.element;
    viewerElement.appendChild(canvas);

    const ctx = canvas.getContext('2d', {
      willReadFrequently: true,
      alpha: true,
      desynchronized: true,
    });
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(0.5, 0.5);
    }

    console.log('Canvas setup:', {
      canvasSize: { width: canvas.width, height: canvas.height },
      containerSize: containerSize,
    });
  };

  const clearDrawingCanvas = () => {
    if (!drawingCanvasRef.current) return;
    const ctx = drawingCanvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(
        0,
        0,
        drawingCanvasRef.current.width,
        drawingCanvasRef.current.height,
      );
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

    console.log('Drawing polygon with points:', polygonPoints);

    const canvasPoints = polygonPoints.map(([x, y]) => {
      try {
        const imagePoint = new OpenSeadragon.Point(x, y);
        const viewportPoint =
          viewer.viewport.imageToViewportCoordinates(imagePoint);
        const pixelPoint =
          viewer.viewport.viewportToViewerElementCoordinates(viewportPoint);

        const canvasX = Math.max(
          0,
          Math.min(canvas.width, Math.round(pixelPoint.x * 10) / 10),
        );
        const canvasY = Math.max(
          0,
          Math.min(canvas.height, Math.round(pixelPoint.y * 10) / 10),
        );

        return [canvasX, canvasY];
      } catch (error) {
        console.error('Error converting coordinates:', error);
        return [canvas.width / 2, canvas.height / 2];
      }
    });

    console.log('Canvas points:', canvasPoints);

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

      ctx.fillStyle = primaryColor
        .replace('26%)', '26%, 0.2)')
        .replace('hsl', 'hsla');
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

    console.log('Polygon drawn on canvas');
  };

  const drawPolygonOnCanvas = () => {
    console.log(
      'drawPolygonOnCanvas called with',
      currentPolygon.length,
      'points',
    );
    drawPolygonWithPoints(currentPolygon);
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
          console.log('Skipping click - was a drag operation');
          return;
        }

        const webPoint = event.position;
        const viewportPoint = viewer.viewport.pointFromPixel(webPoint);
        const imagePoint =
          viewer.viewport.viewportToImageCoordinates(viewportPoint);

        const x = Math.round(imagePoint.x);
        const y = Math.round(imagePoint.y);

        console.log('Click detected:', {
          webPoint,
          viewportPoint,
          imagePoint: { x, y },
          currentPolygonLength: currentPolygon.length,
        });

        if (currentPolygon.length > 0) {
          const lastPoint = currentPolygon[currentPolygon.length - 1];
          const distance = Math.sqrt(
            Math.pow(x - lastPoint[0], 2) + Math.pow(y - lastPoint[1], 2),
          );
          if (distance < 5) {
            console.log('Point too close, skipping');
            return;
          }
        }

        const newPolygon = [...currentPolygon, [x, y] as [number, number]];
        setCurrentPolygon(newPolygon);

        console.log('New polygon set:', newPolygon);

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
    }
  }, [
    viewer,
    isDrawing,
    isVisible,
    currentPolygon,
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
    if (!viewer || !isDrawing) return;

    let lastUpdateTime = 0;
    let rafId: number;

    const handleViewportChange = () => {
      const now = performance.now();

      if (now - lastUpdateTime < 16) {
        return;
      }
      lastUpdateTime = now;

      if (drawingCanvasRef.current && currentPolygon.length > 0) {
        const containerSize = viewer.viewport.containerSize;
        const canvas = drawingCanvasRef.current;

        if (
          canvas.width !== containerSize.x ||
          canvas.height !== containerSize.y
        ) {
          console.log(
            'Container size changed, updating canvas size:',
            containerSize,
          );

          canvas.width = containerSize.x;
          canvas.height = containerSize.y;
          canvas.style.width = '100%';
          canvas.style.height = '100%';
        }

        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(() => {
          drawPolygonOnCanvas();
        });
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
  }, [viewer, isDrawing, currentPolygon]);

  useEffect(() => {
    if (!viewer || !isDrawing || currentPolygon.length === 0) return;

    let animationId: number;
    let isTracking = true;
    let lastRender = performance.now();

    const smoothTrack = (currentTime: number) => {
      if (!isTracking) return;

      if (currentTime - lastRender >= 16.67) {
        if (drawingCanvasRef.current && currentPolygon.length > 0) {
          drawPolygonOnCanvas();
        }
        lastRender = currentTime;
      }

      animationId = requestAnimationFrame(smoothTrack);
    };

    animationId = requestAnimationFrame(smoothTrack);

    return () => {
      isTracking = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [viewer, isDrawing, currentPolygon.length]);

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

    const newAnnotation = {
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      type: 'Annotation',
      motivation: annotationType,
      body: [
        {
          type: 'TextualBody',
          value: '',
          format: 'text/plain',
          purpose: 'supplementing',
        },
      ],
      target: {
        source: canvasId,
        selector: {
          type: 'SvgSelector',
          value: svgString,
        },
      },
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

  return (
    <div className="absolute top-2 right-2 z-[9999] flex gap-2">
      {!isDrawing ? (
        <>
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
