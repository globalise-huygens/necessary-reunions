'use client';

import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/Skeleton';
import { cn } from '@/lib/utils';

interface ImageViewerProps {
  manifest: any;
  currentCanvas: number;
  onCanvasChange?: (index: number) => void;
  onViewerReady?: (viewer: any) => void;
}

export function ImageViewer({
  manifest,
  currentCanvas,
  onViewerReady,
}: ImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const canvas = manifest?.items?.[currentCanvas];
    if (!canvas || !containerRef.current) return;

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

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    if (!service && !url) {
      setLoading(false);
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div class="flex items-center justify-center h-full">
            <div class="text-center p-4">
              <p class="text-red-500 mb-2">No image source found</p>
              <p class="text-sm text-muted-foreground">The manifest does not contain a valid image source.</p>
            </div>
          </div>`;
      }
      return;
    }

    async function initViewer() {
      setLoading(true);
      try {
        const { default: OpenSeadragon } = await import('openseadragon');
        if (!containerRef.current) return;

        const opts: any = {
          element: containerRef.current,
          prefixUrl: '//openseadragon.github.io/openseadragon/images/',
          showNavigationControl: false,
          animationTime: 0.5,
          blendTime: 0.1,
          constrainDuringPan: true,
          maxZoomPixelRatio: 2,
          minZoomLevel: 0.1,
          visibilityRatio: 0.5,
          zoomPerScroll: 1.2,
          showNavigator: true,
          navigatorPosition: 'BOTTOM_RIGHT',
          navigatorHeight: 100,
          navigatorWidth: 150,
          navigatorBackground: '#F1F5F9',
          navigatorBorderColor: '#CBD5E1',
        };

        if (service) {
          const id = service['@id'] || service.id;
          opts.tileSources = {
            '@context': 'http://iiif.io/api/image/2/context.json',
            '@id': id,
            width: canvas.width,
            height: canvas.height,
            profile: ['http://iiif.io/api/image/2/level2.json'],
            protocol: 'http://iiif.io/api/image',
            tiles: [{ scaleFactors: [1, 2, 4, 8, 16, 32], width: 1024 }],
          };
        } else if (url) {
          opts.tileSources = url;
        }

        const v = OpenSeadragon(opts);
        v.addHandler('open', () => setLoading(false));
        v.addHandler('open-failed', (_: any) => {
          setLoading(false);
          if (containerRef.current)
            containerRef.current.innerHTML = `<div class="flex items-center justify-center h-full"><img src="${url}" alt="Image" class="max-h-full max-w-full object-contain"/></div>`;
        });

        viewerRef.current = v;
        onViewerReady?.(v);
      } catch (err: any) {
        setLoading(false);
        if (containerRef.current) {
          const msg = err?.message || 'Failed to load viewer';
          containerRef.current.innerHTML = `<div class="flex items-center justify-center h-full"><div class="text-center p-4"><p class="text-red-500 mb-2">Error loading viewer</p><p class="text-sm text-muted-foreground">${msg}</p></div></div>`;
        }
      }
    }

    initViewer();

    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
      onViewerReady?.(null);
    };
  }, [manifest, currentCanvas, onViewerReady]);

  return (
    <div className={cn('w-full h-full relative')} ref={containerRef}>
      {loading && <Skeleton className="absolute inset-0 w-full h-full" />}
    </div>
  );
}
