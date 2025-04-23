'use client';

import { useEffect, useRef, useState } from 'react';
import type OpenSeadragon from 'openseadragon';
import { Skeleton } from '@/components/Skeleton';

interface ImageViewerProps {
  manifest: any;
  currentCanvas: number;
  onCanvasChange: (index: number) => void;
  onChange?: (updatedManifest: any) => void;
  onViewerReady?: (viewer: any) => void;
}

export function ImageViewer({
  manifest,
  currentCanvas,
  onCanvasChange,
  onViewerReady,
}: ImageViewerProps) {
  const viewerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewer, setViewer] = useState<any>(null);

  useEffect(() => {
    if (!manifest || !manifest.items || !containerRef.current) return;

    const canvas = manifest.items[currentCanvas];
    if (!canvas) return;

    let imageService = null;
    let directImageUrl = null;

    if (canvas.items?.[0]?.items) {
      for (const anno of canvas.items[0].items) {
        if (anno.body) {
          if (anno.body.service) {
            imageService = Array.isArray(anno.body.service)
              ? anno.body.service[0]
              : anno.body.service;
            break;
          } else if (
            anno.body.id &&
            (anno.body.type === 'Image' || anno.motivation === 'painting')
          ) {
            directImageUrl = anno.body.id;
            break;
          }
        }
      }
    }

    setIsLoading(true);

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
      setViewer(null);
    }

    if (!imageService && !directImageUrl) {
      console.error('No image source found in the manifest');
      setIsLoading(false);
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div class="flex items-center justify-center h-full">
            <div class="text-center p-4">
              <p class="text-red-500 mb-2">No image source found</p>
              <p class="text-sm text-muted-foreground">The manifest does not contain a valid image source.</p>
            </div>
          </div>
        `;
      }
      return;
    }

    import('openseadragon')
      .then((module) => {
        const OpenSeadragon = module.default;
        if (!containerRef.current) return;

        try {
          const options: OpenSeadragon.Options = {
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

          if (imageService && (imageService['@id'] || imageService.id)) {
            const serviceId = imageService['@id'] || imageService.id;

            options.tileSources = {
              '@context': 'http://iiif.io/api/image/2/context.json',
              '@id': serviceId,
              height: canvas.height,
              width: canvas.width,
              profile: ['http://iiif.io/api/image/2/level2.json'],
              protocol: 'http://iiif.io/api/image',
              tiles: [
                {
                  scaleFactors: [1, 2, 4, 8, 16, 32],
                  width: 1024,
                },
              ],
            } as unknown as OpenSeadragon.TileSource;
          }

          const viewer = OpenSeadragon(options);

          viewer.addHandler('open', () => {
            setIsLoading(false);
          });

          viewer.addHandler(
            'open-failed',
            (event: OpenSeadragon.OpenFailedEvent) => {
              console.error('OpenSeadragon open failed:', event);
              setIsLoading(false);

              if (containerRef.current && directImageUrl) {
                containerRef.current.innerHTML = `
                <div class="flex items-center justify-center h-full">
                  <img src="${directImageUrl}" alt="Image" class="max-h-full max-w-full object-contain" />
                </div>
              `;
              } else if (containerRef.current) {
                containerRef.current.innerHTML = `
                <div class="flex items-center justify-center h-full">
                  <div class="text-center p-4">
                    <p class="text-red-500 mb-2">Failed to load image</p>
                    <p class="text-sm text-muted-foreground">The image could not be loaded.</p>
                  </div>
                </div>
              `;
              }
            },
          );

          viewerRef.current = viewer;
          if (onViewerReady) onViewerReady(viewer);
        } catch (error) {
          console.error('Error initializing OpenSeadragon:', error);
          setIsLoading(false);
          if (containerRef.current) {
            containerRef.current.innerHTML = `
              <div class="flex items-center justify-center h-full">
                <div class="text-center p-4">
                  <p class="text-red-500 mb-2">Error loading viewer</p>
                  <p class="text-sm text-muted-foreground">${
                    error instanceof Error ? error.message : 'Unknown error'
                  }</p>
                </div>
              </div>
            `;
          }
        }
      })
      .catch((error) => {
        console.error('Error loading OpenSeadragon:', error);
        setIsLoading(false);
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="flex items-center justify-center h-full">
              <div class="text-center p-4">
                <p class="text-red-500 mb-2">Error loading viewer</p>
                <p class="text-sm text-muted-foreground">Failed to load image viewer component.</p>
              </div>
            </div>
          `;
        }
      });

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
        if (onViewerReady) onViewerReady(null);
      }
    };
  }, [manifest, currentCanvas, onCanvasChange, onViewerReady]);

  return (
    <div className="w-full h-full relative" ref={containerRef}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton className="w-full h-full" />
        </div>
      )}
    </div>
  );
}
