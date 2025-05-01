'use client';

import React, { useEffect, useRef, useState, RefObject } from 'react';
import { cn } from '@/lib/utils';
import type { Annotation } from '@/lib/types';
import { LoadingSpinner } from './LoadingSpinner';

interface ImageViewerProps {
  manifest: any;
  currentCanvas: number;
  annotations?: Annotation[];
  selectedAnnotationId?: string | null;
  onAnnotationSelect?: (id: string) => void;
  onViewerReady?: (viewer: any) => void;
  containerRef?: RefObject<HTMLDivElement | null>;
}

export function ImageViewer({
  manifest,
  currentCanvas,
  annotations = [],
  selectedAnnotationId = null,
  onAnnotationSelect,
  onViewerReady,
  containerRef: externalRef,
}: ImageViewerProps) {
  const internalRef = useRef<HTMLDivElement | null>(null);
  const containerRef = externalRef ?? internalRef;
  const viewerRef = useRef<any>(null);
  const osdRef = useRef<any>(null);
  const overlaysRef = useRef<HTMLDivElement[]>([]);
  const vpRectsRef = useRef<Record<string, any>>({});
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const onSelectRef = useRef(onAnnotationSelect);
  useEffect(() => {
    onSelectRef.current = onAnnotationSelect;
  }, [onAnnotationSelect]);

  const selectedIdRef = useRef<string | null>(selectedAnnotationId);
  useEffect(() => {
    selectedIdRef.current = selectedAnnotationId;
  }, [selectedAnnotationId]);

  const addOverlaysRef = useRef<() => void>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tooltipRef.current) {
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
        zIndex: '1000',
        pointerEvents: 'none',
      });
      document.body.appendChild(tip);
      tooltipRef.current = tip;
    }
  }, []);

  useEffect(() => {
    const canvas = manifest?.items?.[currentCanvas];
    if (!canvas || !containerRef.current) return;

    setLoading(true);
    viewerRef.current?.destroy();
    viewerRef.current = null;
    overlaysRef.current = [];
    vpRectsRef.current = {};

    const items = canvas.items?.[0]?.items || [];
    const { service, url } = items.reduce(
      (acc: any, { body, motivation }: any) => {
        if (!acc.service && body?.service)
          acc.service = Array.isArray(body.service)
            ? body.service[0]
            : body.service;
        if (
          !acc.url &&
          body?.id &&
          (body.type === 'Image' || motivation === 'painting')
        )
          acc.url = body.id;
        return acc;
      },
      { service: null, url: null },
    );

    if (!service && !url) {
      setLoading(false);
      containerRef.current.innerHTML = `
        <div class="flex items-center justify-center h-full">
          <div class="text-red-500">No image source found</div>
        </div>`;
      return;
    }

    async function initViewer() {
      try {
        const { default: OpenSeadragon } = await import('openseadragon');
        osdRef.current = OpenSeadragon;
        if (!containerRef.current) return;

        const viewer = OpenSeadragon({
          element: containerRef.current,
          prefixUrl: '//openseadragon.github.io/openseadragon/images/',
          tileSources: service
            ? {
                '@context': 'http://iiif.io/api/image/2/context.json',
                '@id': service['@id'] || service.id,
                width: canvas.width,
                height: canvas.height,
                profile: ['http://iiif.io/api/image/2/level2.json'],
                protocol: 'http://iiif.io/api/image',
                tiles: [{ scaleFactors: [1, 2, 4, 8], width: 512 }],
              }
            : url,
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

        const updateTooltipPosition = (evt: MouseEvent) => {
          const tt = tooltipRef.current!;
          const offset = 10;
          tt.style.left = `${evt.pageX + offset}px`;
          tt.style.top = `${evt.pageY + offset}px`;
          const r = tt.getBoundingClientRect();
          if (r.right > window.innerWidth)
            tt.style.left = `${evt.pageX - r.width - offset}px`;
          if (r.bottom > window.innerHeight)
            tt.style.top = `${evt.pageY - r.height - offset}px`;
        };

        function addOverlays() {
          viewer.clearOverlays();
          overlaysRef.current = [];
          vpRectsRef.current = {};

          const list = annotations;
          list.forEach((anno) => {
            let svg: string | null = null;
            const sel = anno.target?.selector;
            if (sel) {
              if (sel.type === 'SvgSelector') svg = sel.value;
              else if (Array.isArray(sel)) {
                const found = sel.find((s: any) => s.type === 'SvgSelector');
                if (found) svg = found.value;
              }
            }
            if (!svg) return;

            const poly = svg.match(/<polygon points="([^"]+)"/);
            if (!poly) return;

            const coords = poly[1]
              .trim()
              .split(/\s+/)
              .map((pt) => pt.split(',').map(Number));

            const rect = coords.reduce(
              (r, [x, y]) => {
                r.minX = Math.min(r.minX, x);
                r.minY = Math.min(r.minY, y);
                r.maxX = Math.max(r.maxX, x);
                r.maxY = Math.max(r.maxY, y);
                return r;
              },
              {
                minX: Infinity,
                minY: Infinity,
                maxX: -Infinity,
                maxY: -Infinity,
              },
            );
            const x = rect.minX,
              y = rect.minY,
              w = rect.maxX - rect.minX,
              h = rect.maxY - rect.minY;

            const imgRect = new OpenSeadragon.Rect(x, y, w, h);
            const vpRect = viewer.viewport.imageToViewportRectangle(imgRect);
            vpRectsRef.current[anno.id] = vpRect;

            const isSel = anno.id === selectedIdRef.current;
            const overlay = document.createElement('div');
            overlay.dataset.annotationId = anno.id;
            Object.assign(overlay.style, {
              position: 'absolute',
              pointerEvents: 'auto',
              zIndex: '1000',
              clipPath: `polygon(${coords
                .map(
                  ([cx, cy]) =>
                    `${((cx - x) / w) * 100}% ${((cy - y) / h) * 100}%`,
                )
                .join(',')})`,
              backgroundColor: isSel
                ? 'rgba(255,0,0,0.3)'
                : 'rgba(0,100,255,0.2)',
              border: isSel
                ? '2px solid rgba(255,0,0,0.8)'
                : '1px solid rgba(0,100,255,0.6)',
              cursor: 'pointer',
            });

            const textVal = Array.isArray(anno.body)
              ? anno.body.find((b) => b.type === 'TextualBody')?.value
              : (anno.body as any).value;
            if (textVal) overlay.dataset.tooltipText = textVal;

            overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
            overlay.addEventListener('click', (e) => {
              e.stopPropagation();
              onSelectRef.current?.(anno.id);
            });
            overlay.addEventListener('mouseenter', (e) => {
              if (tooltipRef.current && overlay.dataset.tooltipText) {
                tooltipRef.current.textContent = overlay.dataset.tooltipText;
                tooltipRef.current.style.display = 'block';
                updateTooltipPosition(e as MouseEvent);
              }
            });
            overlay.addEventListener('mousemove', updateTooltipPosition);
            overlay.addEventListener('mouseleave', () => {
              tooltipRef.current!.style.display = 'none';
            });

            viewer.addOverlay({ element: overlay, location: vpRect });
            overlaysRef.current.push(overlay);
          });
        }

        addOverlaysRef.current = addOverlays;

        viewer.addHandler('open', () => {
          setLoading(false);
          if (annotations.length) addOverlays();
        });
        viewer.addHandler('animation', () => {
          if (annotations.length) addOverlays();
        });
      } catch (err: any) {
        setLoading(false);
        containerRef.current!.innerHTML = `
          <div class="flex items-center justify-center h-full">
            <div class="text-red-500 p-2">Error loading viewer: ${err.message}</div>
          </div>`;
      }
    }

    initViewer();
    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [manifest, currentCanvas, annotations]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const sel = selectedAnnotationId;
    if (viewer && sel) {
      const vpRect = vpRectsRef.current[sel];
      if (vpRect && osdRef.current) {
        const Rect = osdRef.current.Rect;
        const factor = 7;
        const ex = new Rect(
          vpRect.x - (vpRect.width * (factor - 1)) / 2,
          vpRect.y - (vpRect.height * (factor - 1)) / 2,
          vpRect.width * factor,
          vpRect.height * factor,
        );
        viewer.viewport.fitBounds(ex, false);
      }
      addOverlaysRef.current?.();
    }
  }, [selectedAnnotationId]);

  return (
    <div className={cn('w-full h-full relative')} ref={containerRef}>
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 z-50 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
}
