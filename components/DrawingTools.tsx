'use client';

import { useToast } from '@/hooks/use-toast';
import { Check, Pen, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from './Button';

// Declare OpenSeadragon global variable without import
// We'll use the instance provided by the viewer object
// to avoid SSR issues with direct imports
let OpenSeadragon: any;

interface DrawingToolsProps {
  viewer: any | null;
  canvasId: string;
  isVisible: boolean;
  onNewAnnotation: (annotation: any) => void;
}

export function DrawingTools({
  viewer,
  canvasId,
  isVisible,
  onNewAnnotation,
}: DrawingToolsProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPolygon, setCurrentPolygon] = useState<Array<[number, number]>>(
    [],
  );
  // Toast states
  const [annotationCreatedToast, setAnnotationCreatedToast] = useState(false);
  const [annotationErrorToast, setAnnotationErrorToast] = useState(false);
  const [showDrawingStartToast, setShowDrawingStartToast] = useState(false);
  const [showCancelToast, setShowCancelToast] = useState(false);
  const [showNotEnoughPointsToast, setShowNotEnoughPointsToast] =
    useState(false);

  const pointOverlaysRef = useRef<any[]>([]);
  const lineOverlaysRef = useRef<any[]>([]);
  const clickHandlerRef = useRef<((event: any) => void) | null>(null);
  const dblClickHandlerRef = useRef<((event: any) => void) | null>(null);
  const polygonOverlayRef = useRef<any>(null);
  const { data: session } = useSession();
  const { toast } = useToast();

  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (annotationCreatedToast && isMounted.current) {
      toast({
        title: 'Annotation created',
        description: 'Edit text and details in the sidebar',
      });
      setAnnotationCreatedToast(false);
    }
  }, [annotationCreatedToast, toast]);

  useEffect(() => {
    if (annotationErrorToast && isMounted.current) {
      toast({
        title: 'Error',
        description: 'Failed to create annotation',
      });
      setAnnotationErrorToast(false);
    }
  }, [annotationErrorToast, toast]);

  useEffect(() => {
    if (showNotEnoughPointsToast && isMounted.current) {
      toast({
        title: 'Not enough points',
        description: 'At least 3 points are needed to create a polygon',
      });
      setShowNotEnoughPointsToast(false);
    }
  }, [showNotEnoughPointsToast, toast]);

  const closingLineRef = useRef<any>(null);

  const updateClosingLine = () => {
    if (!viewer || currentPolygon.length < 3) {
      if (closingLineRef.current) {
        try {
          viewer.removeOverlay(closingLineRef.current);
          closingLineRef.current = null;
        } catch (e) {
          console.error('Failed to remove closing line overlay', e);
        }
      }
      return;
    }

    const firstPoint = currentPolygon[0];
    const lastPoint = currentPolygon[currentPolygon.length - 1];

    const OSD = viewer.constructor.constructor;
    const firstViewportPoint = viewer.viewport.imageToViewportCoordinates(
      new OSD.Point(firstPoint[0], firstPoint[1]),
    );
    const lastViewportPoint = viewer.viewport.imageToViewportCoordinates(
      new OSD.Point(lastPoint[0], lastPoint[1]),
    );

    if (closingLineRef.current) {
      try {
        viewer.removeOverlay(closingLineRef.current);
        closingLineRef.current = null;
      } catch (e) {
        console.error('Failed to remove closing line overlay', e);
      }
    }

    const lineDiv = document.createElement('div');
    lineDiv.style.position = 'absolute';
    lineDiv.style.border = '2px dashed rgba(255,0,0,0.7)';
    lineDiv.style.pointerEvents = 'none';
    lineDiv.style.transformOrigin = '0 0';

    const dx = firstViewportPoint.x - lastViewportPoint.x;
    const dy = firstViewportPoint.y - lastViewportPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    lineDiv.style.width = `${length * viewer.viewport.containerSize.x}px`;
    lineDiv.style.height = '0';
    lineDiv.style.transform = `rotate(${angle}deg)`;

    closingLineRef.current = viewer.addOverlay({
      element: lineDiv,
      location: lastViewportPoint,
      placement: 'TOP_LEFT',
    });
  };

  const updatePolygonOverlay = () => {
    if (!viewer || currentPolygon.length < 3) {
      if (polygonOverlayRef.current) {
        try {
          viewer.removeOverlay(polygonOverlayRef.current);
          polygonOverlayRef.current = null;
        } catch (e) {
          console.error('Failed to remove polygon overlay', e);
        }
      }
      return;
    }

    const bbox = currentPolygon.reduce(
      (r, [x, y]) => ({
        minX: Math.min(r.minX, x),
        minY: Math.min(r.minY, y),
        maxX: Math.max(r.maxX, x),
        maxY: Math.max(r.maxY, y),
      }),
      {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
      },
    );

    if (polygonOverlayRef.current) {
      try {
        viewer.removeOverlay(polygonOverlayRef.current);
        polygonOverlayRef.current = null;
      } catch (e) {
        console.error('Failed to remove polygon overlay', e);
      }
    }

    const svgNamespace = 'http://www.w3.org/2000/svg';
    const svgElem = document.createElementNS(svgNamespace, 'svg');
    svgElem.setAttribute('width', '100%');
    svgElem.setAttribute('height', '100%');
    svgElem.style.position = 'absolute';
    svgElem.style.top = '0';
    svgElem.style.left = '0';

    const polygonElem = document.createElementNS(svgNamespace, 'polygon');

    const pointsString = currentPolygon
      .map(([x, y]) => `${x - bbox.minX},${y - bbox.minY}`)
      .join(' ');

    polygonElem.setAttribute('points', pointsString);
    polygonElem.setAttribute('fill', 'rgba(255, 0, 0, 0.2)');
    polygonElem.setAttribute('stroke', 'red');
    polygonElem.setAttribute('stroke-width', '2');

    svgElem.appendChild(polygonElem);

    const overlayDiv = document.createElement('div');
    overlayDiv.style.position = 'absolute';
    overlayDiv.style.width = '100%';
    overlayDiv.style.height = '100%';
    overlayDiv.style.pointerEvents = 'none';
    overlayDiv.appendChild(svgElem);

    const OSD = viewer.constructor.constructor;
    const rect = new OSD.Rect(
      bbox.minX,
      bbox.minY,
      bbox.maxX - bbox.minX,
      bbox.maxY - bbox.minY,
    );

    const viewportRect = viewer.viewport.imageToViewportRectangle(rect);

    polygonOverlayRef.current = viewer.addOverlay({
      element: overlayDiv,
      location: viewportRect,
    });
  };

  useEffect(() => {
    if (!viewer || !isVisible) return;

    if (isDrawing) {
      clickHandlerRef.current = (event: any) => {
        const webPoint = event.position;
        const viewportPoint = viewer.viewport.pointFromPixel(webPoint);
        const imagePoint =
          viewer.viewport.viewportToImageCoordinates(viewportPoint);

        const x = Math.round(imagePoint.x);
        const y = Math.round(imagePoint.y);

        const newPolygon = [...currentPolygon, [x, y] as [number, number]];
        setCurrentPolygon(newPolygon);

        const pointDiv = document.createElement('div');
        pointDiv.style.position = 'absolute';
        pointDiv.style.width = currentPolygon.length === 0 ? '10px' : '8px';
        pointDiv.style.height = currentPolygon.length === 0 ? '10px' : '8px';
        pointDiv.style.borderRadius = '50%';
        pointDiv.style.backgroundColor =
          currentPolygon.length === 0 ? 'gold' : 'red';
        pointDiv.style.border =
          currentPolygon.length === 0 ? '2px solid red' : '1px solid white';
        pointDiv.style.transform = 'translate(-50%, -50%)';
        pointDiv.style.pointerEvents = 'none';
        pointDiv.style.zIndex = '1000';

        const pointOverlay = viewer.addOverlay({
          element: pointDiv,
          location: viewportPoint,
          placement: 'CENTER',
        });
        pointOverlaysRef.current.push(pointOverlay);

        if (currentPolygon.length > 0) {
          const prevPoint = currentPolygon[currentPolygon.length - 1];
          const prevViewportPoint = viewer.viewport.imageToViewportCoordinates(
            new viewer.constructor.constructor.Point(
              prevPoint[0],
              prevPoint[1],
            ),
          );

          const lineDiv = document.createElement('div');
          lineDiv.style.position = 'absolute';
          lineDiv.style.border = '2px solid red';
          lineDiv.style.pointerEvents = 'none';
          lineDiv.style.transformOrigin = '0 0';

          const dx = viewportPoint.x - prevViewportPoint.x;
          const dy = viewportPoint.y - prevViewportPoint.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);

          lineDiv.style.width = `${length * viewer.viewport.containerSize.x}px`;
          lineDiv.style.height = '0';
          lineDiv.style.transform = `rotate(${angle}deg)`;

          const lineOverlay = viewer.addOverlay({
            element: lineDiv,
            location: prevViewportPoint,
            placement: 'TOP_LEFT',
          });
          lineOverlaysRef.current.push(lineOverlay);
        }

        if (newPolygon.length >= 3) {
          updateClosingLine();
          updatePolygonOverlay();
        }
      };

      dblClickHandlerRef.current = (event: any) => {
        if (currentPolygon.length >= 3) {
          event.preventDefaultAction = true;
          finishDrawing();
        } else {
          setShowNotEnoughPointsToast(true);
        }
      };

      viewer.addHandler('canvas-click', clickHandlerRef.current);
      viewer.addHandler('canvas-double-click', dblClickHandlerRef.current);

      return () => {
        if (clickHandlerRef.current) {
          viewer.removeHandler('canvas-click', clickHandlerRef.current);
        }
        if (dblClickHandlerRef.current) {
          viewer.removeHandler(
            'canvas-double-click',
            dblClickHandlerRef.current,
          );
        }
      };
    }
  }, [
    viewer,
    isDrawing,
    isVisible,
    currentPolygon,
    toast,
    updateClosingLine,
    updatePolygonOverlay,
  ]);

  useEffect(() => {
    if (showDrawingStartToast && isMounted.current) {
      toast({
        title: 'Drawing mode activated',
        description: 'Click to add points. Double-click to finish.',
      });
      setShowDrawingStartToast(false);
    }
  }, [showDrawingStartToast, toast]);

  const startDrawing = () => {
    if (!viewer) return;

    setIsDrawing(true);
    setCurrentPolygon([]);
    clearOverlays();
    setShowDrawingStartToast(true);
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
  };

  useEffect(() => {
    if (showCancelToast && isMounted.current) {
      toast({
        title: 'Drawing cancelled',
        description: 'Drawing mode deactivated',
      });
      setShowCancelToast(false);
    }
  }, [showCancelToast, toast]);

  const cancelDrawing = () => {
    if (!viewer) return;

    setIsDrawing(false);
    setCurrentPolygon([]);
    clearOverlays();
    setShowCancelToast(true);
  };

  const finishDrawing = async () => {
    if (!viewer || !canvasId) return;

    setIsDrawing(false);

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg"><polygon points="${currentPolygon
      .map((point) => `${point[0]},${point[1]}`)
      .join(' ')}"/></svg>`;

    const newAnnotation = {
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      type: 'Annotation',
      motivation: 'textspotting',
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

      setAnnotationCreatedToast(true);
    } catch (error) {
      console.error('Error creating annotation:', error);
      setAnnotationErrorToast(true);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="absolute top-2 right-2 z-10 flex gap-2">
      {!isDrawing ? (
        <Button
          size="sm"
          onClick={startDrawing}
          className="bg-primary text-white hover:bg-primary/90"
        >
          <Pen className="h-4 w-4 mr-1" />
          Draw Annotation
        </Button>
      ) : (
        <>
          <Button
            size="sm"
            onClick={finishDrawing}
            disabled={currentPolygon.length < 3}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            <Check className="h-4 w-4 mr-1" />
            Finish
          </Button>
          <Button size="sm" onClick={cancelDrawing} variant="destructive">
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </>
      )}
    </div>
  );
}
