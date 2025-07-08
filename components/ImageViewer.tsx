'use client';

import { getCanvasImageInfo, getManifestCanvases } from '@/lib/iiif-helpers';
import type { Annotation } from '@/lib/types';
import { cn } from '@/lib/utils';
import { RotateCcw, RotateCw } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { DrawingTools } from './DrawingTools';
import { LoadingSpinner } from './LoadingSpinner';

interface ImageViewerProps {
  manifest: any;
  currentCanvas: number;
  annotations?: Annotation[];
  selectedAnnotationId?: string | null;
  onAnnotationSelect?: (id: string) => void;
  onViewerReady?: (viewer: any) => void;
  onNewAnnotation?: (annotation: Annotation) => void;
  showAITextspotting: boolean;
  showAIIconography: boolean;
  showHumanTextspotting: boolean;
  showHumanIconography: boolean;
  viewMode: 'image' | 'annotation' | 'map' | 'gallery' | 'info';
}

export function ImageViewer({
  manifest,
  currentCanvas,
  annotations = [],
  selectedAnnotationId = null,
  onAnnotationSelect,
  onViewerReady,
  onNewAnnotation,
  showAITextspotting,
  showAIIconography,
  showHumanTextspotting,
  showHumanIconography,
  viewMode,
}: ImageViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const osdRef = useRef<any>(null);
  const overlaysRef = useRef<HTMLDivElement[]>([]);
  const vpRectsRef = useRef<Record<string, any>>({});
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onAnnotationSelect);
  const selectedIdRef = useRef<string | null>(selectedAnnotationId);

  const lastViewportRef = useRef<any>(null);

  const [rotation, setRotation] = useState(0);
  const [isDrawingActive, setIsDrawingActive] = useState(false);

  const isAIGenerated = (annotation: Annotation) => {
    if (annotation.creator) {
      return false;
    }

    const bodies = Array.isArray(annotation.body)
      ? annotation.body
      : [annotation.body];
    const textualBodies = bodies.filter((b) => b?.type === 'TextualBody');
    const hasAIGenerator = textualBodies.some(
      (body) =>
        body.generator?.id?.includes('MapTextPipeline') ||
        body.generator?.label?.toLowerCase().includes('loghi') ||
        body.generator?.id?.includes('segment_icons.py'),
    );

    const hasTargetAIGenerator =
      annotation.target?.generator?.id?.includes('segment_icons.py');

    return hasAIGenerator || hasTargetAIGenerator;
  };

  const isHumanCreated = (annotation: Annotation) => {
    return !!annotation.creator;
  };

  const isTextAnnotation = (annotation: Annotation) => {
    return annotation.motivation === 'textspotting';
  };

  const isIconAnnotation = (annotation: Annotation) => {
    return (
      annotation.motivation === 'iconography' ||
      annotation.motivation === 'iconograpy'
    );
  };

  const shouldShowAnnotation = (annotation: Annotation) => {
    const isAI = isAIGenerated(annotation);
    const isHuman = isHumanCreated(annotation);
    const isText = isTextAnnotation(annotation);
    const isIcon = isIconAnnotation(annotation);

    if (isAI && isText && showAITextspotting) return true;
    if (isAI && isIcon && showAIIconography) return true;
    if (isHuman && isText && showHumanTextspotting) return true;
    if (isHuman && isIcon && showHumanIconography) return true;

    return false;
  };

  const rotateClockwise = () => {
    if (viewerRef.current) {
      const newRotation = (rotation + 90) % 360;
      setRotation(newRotation);
      viewerRef.current.viewport.setRotation(newRotation);
    }
  };

  const rotateCounterClockwise = () => {
    if (viewerRef.current) {
      const newRotation = (rotation - 90 + 360) % 360;
      setRotation(newRotation);
      viewerRef.current.viewport.setRotation(newRotation);
    }
  };

  const [loading, setLoading] = useState(true);
  const [noSource, setNoSource] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const updateTooltip = (e: MouseEvent) => {
    const tt = tooltipRef.current!;
    const offset = 10;
    tt.style.left = `${e.pageX + offset}px`;
    tt.style.top = `${e.pageY + offset}px`;
    const r = tt.getBoundingClientRect();
    if (r.right > window.innerWidth)
      tt.style.left = `${e.pageX - r.width - offset}px`;
    if (r.bottom > window.innerHeight)
      tt.style.top = `${e.pageY - r.height - offset}px`;
  };

  const addOverlays = (viewer: any) => {
    viewer.clearOverlays();
    overlaysRef.current = [];
    vpRectsRef.current = {};

    for (const anno of annotations) {
      if (!shouldShowAnnotation(anno)) continue;

      let svgVal: string | null = null;
      const sel = anno.target?.selector;
      if (sel) {
        if (sel.type === 'SvgSelector') svgVal = sel.value;
        else if (Array.isArray(sel)) {
          const f = sel.find((s: any) => s.type === 'SvgSelector');
          if (f) svgVal = f.value;
        }
      }
      if (!svgVal) continue;

      const match = svgVal.match(/<polygon points="([^\"]+)"/);
      if (!match) continue;

      const coords = match[1]
        .trim()
        .split(/\s+/)
        .map((pt) => pt.split(',').map(Number));
      const bbox = coords.reduce(
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
      const [x, y, w, h] = [
        bbox.minX,
        bbox.minY,
        bbox.maxX - bbox.minX,
        bbox.maxY - bbox.minY,
      ];
      const imgRect = new osdRef.current!.Rect(x, y, w, h);
      const vpRect = viewer.viewport.imageToViewportRectangle(imgRect);
      vpRectsRef.current[anno.id] = vpRect;

      const div = document.createElement('div');
      div.dataset.annotationId = anno.id;
      div.dataset.humanModified = anno.creator ? 'true' : 'false';
      Object.assign(div.style, {
        position: 'absolute',
        pointerEvents: isDrawingActive ? 'none' : 'auto',
        zIndex: '20',
        clipPath: `polygon(${coords
          .map(
            ([cx, cy]) => `${((cx - x) / w) * 100}% ${((cy - y) / h) * 100}%`,
          )
          .join(',')})`,
        cursor: 'pointer',
      });

      const textBody = Array.isArray(anno.body)
        ? anno.body.find((b) => b.type === 'TextualBody')
        : (anno.body as any);
      if (textBody?.value) div.dataset.tooltipText = textBody.value;

      div.addEventListener('pointerdown', (e) => e.stopPropagation());
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectRef.current?.(anno.id);
      });
      div.addEventListener('mouseenter', (e) => {
        const tt = tooltipRef.current!;
        if (div.dataset.tooltipText) {
          tt.textContent = div.dataset.tooltipText;
          tt.style.display = 'block';
          updateTooltip(e);
        }
      });
      div.addEventListener('mousemove', updateTooltip);
      div.addEventListener('mouseleave', () => {
        tooltipRef.current!.style.display = 'none';
      });

      viewer.addOverlay({ element: div, location: vpRect });
      overlaysRef.current.push(div);
    }
  };

  const zoomToSelected = () => {
    const id = selectedIdRef.current;
    const viewer = viewerRef.current;
    const osd = osdRef.current;
    if (!viewer || !osd || !id) return;
    const vpRect = vpRectsRef.current[id];
    if (!vpRect) return;

    const Rect = osd.Rect;
    const factor = 7;
    const expanded = new Rect(
      vpRect.x - (vpRect.width * (factor - 1)) / 2,
      vpRect.y - (vpRect.height * (factor - 1)) / 2,
      vpRect.width * factor,
      vpRect.height * factor,
    );

    viewer.viewport.fitBounds(expanded, true);
  };

  useEffect(() => {
    if (tooltipRef.current) return;
    const tip = document.createElement('div');
    tip.className = 'annotation-tooltip';
    Object.assign(tip.style, {
      position: 'absolute',
      display: 'none',
      backgroundColor: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      zIndex: '20',
      pointerEvents: 'none',
    });
    document.body.appendChild(tip);
    tooltipRef.current = tip;
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    const canvases = getManifestCanvases(manifest);
    const canvas = canvases[currentCanvas];
    if (!container || !canvas) return;

    setLoading(true);
    setNoSource(false);
    setErrorMsg(null);
    setRotation(0);

    if (viewerRef.current) {
      try {
        viewerRef.current.destroy();
      } catch (e) {}
      viewerRef.current = null;
    }
    overlaysRef.current = [];
    vpRectsRef.current = {};

    const { service, url } = getCanvasImageInfo(canvas);

    if (!service && !url) {
      setLoading(false);
      setNoSource(true);
      return;
    }

    const needsProxy = (imageUrl: string): boolean => {
      if (!imageUrl) return false;
      try {
        const urlObj = new URL(imageUrl);
        const currentOrigin = window.location.origin;
        return urlObj.origin !== currentOrigin;
      } catch {
        return false;
      }
    };

    const getProxiedUrl = (imageUrl: string): string => {
      if (!needsProxy(imageUrl)) return imageUrl;
      return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    };

    async function initViewer() {
      try {
        const { default: OpenSeadragon } = await import('openseadragon');
        osdRef.current = OpenSeadragon;

        const viewer = OpenSeadragon({
          element: container!,
          prefixUrl: '//openseadragon.github.io/openseadragon/images/',
          tileSources: service
            ? ({
                '@context': 'http://iiif.io/api/image/2/context.json',
                '@id': service['@id'] || service.id,
                width: canvas.width,
                height: canvas.height,
                profile: ['http://iiif.io/api/image/2/level2.json'],
                protocol: 'http://iiif.io/api/image',
                tiles: [{ scaleFactors: [1, 2, 4, 8], width: 512 }],
              } as any)
            : ({
                type: 'image',
                url: getProxiedUrl(url),
                buildPyramid: false,
              } as any),
          crossOriginPolicy: 'Anonymous',
          gestureSettingsMouse: {
            scrollToZoom: true,
            clickToZoom: false,
            dblClickToZoom: true,
            pinchToZoom: true,
          },
          gestureSettingsTouch: {
            scrollToZoom: false,
            clickToZoom: false,
            dblClickToZoom: true,
            pinchToZoom: true,
          },
          showNavigationControl: false,
          animationTime: 0,
          immediateRender: true,
          showNavigator: true,
          navigatorPosition: 'BOTTOM_RIGHT',
          navigatorHeight: 100,
          navigatorWidth: 150,
          navigatorBackground: '#F1F5F9',
          navigatorBorderColor: '#CBD5E1',
        });

        viewer.addHandler('canvas-click', (evt: any) => {
          evt.preventDefaultAction = true;
        });

        viewerRef.current = viewer;
        onViewerReady?.(viewer);

        viewer.addHandler('open', () => {
          setLoading(false);
          viewer.viewport.setRotation(0);
          if (lastViewportRef.current) {
            viewer.viewport.fitBounds(lastViewportRef.current, true);
            lastViewportRef.current = null;
          }
          if (annotations.length > 0 && viewMode === 'annotation') {
            addOverlays(viewer);
            overlaysRef.current.forEach((d) => {
              const isSel = d.dataset.annotationId === selectedAnnotationId;
              const isHumanModified = d.dataset.humanModified === 'true';

              if (isSel) {
                d.style.backgroundColor = 'rgba(255,0,0,0.3)';
                d.style.border = '2px solid rgba(255,0,0,0.8)';
              } else if (isHumanModified) {
                d.style.backgroundColor = 'rgba(174,190,190,0.25)';
                d.style.border = '1px solid rgba(174,190,190,0.8)';
              } else {
                d.style.backgroundColor = 'rgba(0,100,255,0.2)';
                d.style.border = '1px solid rgba(0,100,255,0.6)';
              }
            });
            zoomToSelected();
          }
        });

        container?.addEventListener('click', (e: MouseEvent) => {
          const el = (e.target as HTMLElement).closest(
            '[data-annotation-id]',
          ) as HTMLElement;
          if (el?.dataset.annotationId) {
            e.stopPropagation();
            onSelectRef.current?.(el.dataset.annotationId);
          }
        });

        const updateTooltip = (e: MouseEvent) => {
          const tt = tooltipRef.current!;
          const offset = 10;
          tt.style.left = `${e.pageX + offset}px`;
          tt.style.top = `${e.pageY + offset}px`;
          const r = tt.getBoundingClientRect();
          if (r.right > window.innerWidth)
            tt.style.left = `${e.pageX - r.width - offset}px`;
          if (r.bottom > window.innerHeight)
            tt.style.top = `${e.pageY - r.height - offset}px`;
        };

        viewer.addHandler('animation', () => {
          overlaysRef.current.forEach((d) => {
            const vpRect = vpRectsRef.current[d.dataset.annotationId!];
            viewer.updateOverlay(d, vpRect);
          });
        });
      } catch (err: any) {
        setLoading(false);
        setErrorMsg(err.message);
      }
    }

    initViewer();

    return () => {
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch (e) {}
        viewerRef.current = null;
      }
      overlaysRef.current = [];
      vpRectsRef.current = {};
    };
  }, [
    manifest,
    currentCanvas,
    annotations,
    showAITextspotting,
    showAIIconography,
    showHumanTextspotting,
    showHumanIconography,
  ]);

  useEffect(() => {
    if (!viewerRef.current) return;

    overlaysRef.current.forEach((d) => {
      const isSel = d.dataset.annotationId === selectedAnnotationId;
      const isHumanModified = d.dataset.humanModified === 'true';

      if (isSel) {
        d.style.backgroundColor = 'rgba(255,0,0,0.3)';
        d.style.border = '2px solid rgba(255,0,0,0.8)';
      } else if (isHumanModified) {
        d.style.backgroundColor = 'rgba(174,190,190,0.25)';
        d.style.border = '1px solid rgba(174,190,190,0.8)';
      } else {
        d.style.backgroundColor = 'rgba(0,100,255,0.2)';
        d.style.border = '1px solid rgba(0,100,255,0.6)';
      }
    });
    zoomToSelected();
  }, [selectedAnnotationId]);

  useEffect(() => {
    if (!viewerRef.current) return;

    if (viewMode === 'annotation' && annotations.length > 0) {
      addOverlays(viewerRef.current);
      overlaysRef.current.forEach((d) => {
        const isSel = d.dataset.annotationId === selectedAnnotationId;
        const isHumanModified = d.dataset.humanModified === 'true';

        if (isSel) {
          d.style.backgroundColor = 'rgba(255,0,0,0.3)';
          d.style.border = '2px solid rgba(255,0,0,0.8)';
        } else if (isHumanModified) {
          d.style.backgroundColor = 'rgba(174,190,190,0.25)';
          d.style.border = '1px solid rgba(174,190,190,0.8)';
        } else {
          d.style.backgroundColor = 'rgba(0,100,255,0.2)';
          d.style.border = '1px solid rgba(0,100,255,0.6)';
        }
      });
    } else {
      viewerRef.current.clearOverlays();
      overlaysRef.current = [];
      vpRectsRef.current = {};
    }
  }, [viewMode, annotations, selectedAnnotationId]);

  useEffect(() => {
    overlaysRef.current.forEach((overlay) => {
      overlay.style.pointerEvents = isDrawingActive ? 'none' : 'auto';
    });
  }, [isDrawingActive]);

  return (
    <div className={cn('w-full h-full relative')}>
      <DrawingTools
        viewer={viewerRef.current}
        canvasId={getManifestCanvases(manifest)?.[currentCanvas]?.id ?? ''}
        isVisible={viewMode === 'annotation'}
        onNewAnnotation={(annotation) => {
          if (onNewAnnotation) onNewAnnotation(annotation);
        }}
        onDrawingStateChange={setIsDrawingActive}
      />
      <div ref={mountRef} className="w-full h-full" />

      {loading && annotations.length > 0 && (
        <div className="absolute inset-0 bg-white bg-opacity-40 z-20 flex items-center justify-center pointer-events-none">
          <LoadingSpinner />
        </div>
      )}
      {loading && annotations.length === 0 && (
        <div className="absolute inset-0 bg-white bg-opacity-75 z-50 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      )}
      {noSource && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-red-500">No image source found</div>
        </div>
      )}
      {errorMsg && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-red-500 p-2">
            Error loading viewer: {errorMsg}
          </div>
        </div>
      )}

      {/* Rotation Controls */}
      {(viewMode === 'image' || viewMode === 'info') &&
        !loading &&
        !noSource &&
        !errorMsg && (
          <div className="absolute top-4 right-4 z-30 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={rotateCounterClockwise}
              className="bg-white/90 hover:bg-muted shadow-lg"
              title="Rotate counter-clockwise"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={rotateClockwise}
              className="bg-white/90 hover:bg-muted shadow-lg"
              title="Rotate clockwise"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        )}
    </div>
  );
}
