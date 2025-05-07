'use client';

import React, { useEffect, useRef, useState } from 'react';
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
}

export function ImageViewer({
  manifest,
  currentCanvas,
  annotations = [],
  selectedAnnotationId = null,
  onAnnotationSelect,
  onViewerReady,
}: ImageViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const osdRef = useRef<any>(null);
  const overlaysRef = useRef<HTMLDivElement[]>([]);
  const vpRectsRef = useRef<Record<string, any>>({});
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onAnnotationSelect);
  const selectedIdRef = useRef<string | null>(selectedAnnotationId);

  useEffect(() => {
    onSelectRef.current = onAnnotationSelect;
  }, [onAnnotationSelect]);
  useEffect(() => {
    selectedIdRef.current = selectedAnnotationId;
  }, [selectedAnnotationId]);

  const [loading, setLoading] = useState(true);
  const [noSource, setNoSource] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      zIndex: '1000',
      pointerEvents: 'none',
    });
    document.body.appendChild(tip);
    tooltipRef.current = tip;
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    const canvas = manifest?.items?.[currentCanvas];
    if (!container || !canvas) return;

    setLoading(true);
    setNoSource(false);
    setErrorMsg(null);
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
      setNoSource(true);
      return;
    }

    async function initViewer() {
      try {
        const { default: OpenSeadragon } = await import('openseadragon');
        osdRef.current = OpenSeadragon;

        const viewer = OpenSeadragon({
          element: container || undefined,
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

        function addOverlays() {
          viewer.clearOverlays();
          overlaysRef.current = [];
          vpRectsRef.current = {};

          for (const anno of annotations) {
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
            const match = svgVal.match(/<polygon points="([^"]+)"/);
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
            const imgRect = new OpenSeadragon.Rect(x, y, w, h);
            const vpRect = viewer.viewport.imageToViewportRectangle(imgRect);
            vpRectsRef.current[anno.id] = vpRect;

            const div = document.createElement('div');
            div.dataset.annotationId = anno.id;
            Object.assign(div.style, {
              position: 'absolute',
              pointerEvents: 'auto',
              zIndex: '1000',
              clipPath: `polygon(${coords
                .map(
                  ([cx, cy]) =>
                    `${((cx - x) / w) * 100}% ${((cy - y) / h) * 100}%`,
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
        }

        viewer.addHandler('open', () => {
          setLoading(false);
          if (annotations.length) {
            addOverlays();
            overlaysRef.current.forEach((d) => {
              const isSel = d.dataset.annotationId === selectedAnnotationId;
              d.style.backgroundColor = isSel
                ? 'rgba(255,0,0,0.3)'
                : 'rgba(0,100,255,0.2)';
              d.style.border = isSel
                ? '2px solid rgba(255,0,0,0.8)'
                : '1px solid rgba(0,100,255,0.6)';
            });
            zoomToSelected();
          }
        });

        viewer.addHandler('animation', () => {
          if (annotations.length) {
            overlaysRef.current.forEach((d, i) => {
              const vpRect = vpRectsRef.current[d.dataset.annotationId!];
              viewer.updateOverlay(d, vpRect);
            });
          }
        });
      } catch (err: any) {
        setLoading(false);
        setErrorMsg(err.message);
      }
    }

    initViewer();
    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [manifest, currentCanvas, annotations]);

  useEffect(() => {
    if (!viewerRef.current) return;

    overlaysRef.current.forEach((d) => {
      const isSel = d.dataset.annotationId === selectedAnnotationId;
      d.style.backgroundColor = isSel
        ? 'rgba(255,0,0,0.3)'
        : 'rgba(0,100,255,0.2)';
      d.style.border = isSel
        ? '2px solid rgba(255,0,0,0.8)'
        : '1px solid rgba(0,100,255,0.6)';
    });

    zoomToSelected();
  }, [selectedAnnotationId]);

  return (
    <div className={cn('w-full h-full relative')}>
      <div ref={mountRef} className="w-full h-full" />

      {loading && (
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
    </div>
  );
}
