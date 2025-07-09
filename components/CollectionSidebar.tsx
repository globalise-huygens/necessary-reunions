'use client';

import * as React from 'react';
import { memo, useMemo, useCallback, useState, useRef } from 'react';
import { Badge } from '@/components/Badge';
import { ScrollArea } from '@/components/ScrollArea';
import { getLocalizedValue, getManifestCanvases } from '@/lib/iiif-helpers';
import { cn } from '@/lib/utils';
import {
  Building,
  Calendar,
  Map,
  MessageSquare,
  Ruler,
  User,
} from 'lucide-react';
import * as React from 'react';

interface CollectionSidebarProps {
  manifest: any;
  currentCanvas: number;
  onCanvasSelect: (index: number) => void;
}

const needsProxy = (imageUrl: string): boolean => {
  if (!imageUrl) return false;
  try {
    const urlObj = new URL(imageUrl);
    if (typeof window !== 'undefined') {
      const currentOrigin = window.location.origin;
      return urlObj.origin !== currentOrigin;
    }
    return false;
  } catch {
    return false;
  }
};

const getProxiedUrl = (imageUrl: string): string => {
  if (!needsProxy(imageUrl)) return imageUrl;
  return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
};

const CanvasThumbnail = memo(
  ({
    canvas,
    index,
    isVisible,
  }: {
    canvas: any;
    index: number;
    isVisible: boolean;
  }) => {
    const [imageState, setImageState] = useState<
      'loading' | 'loaded' | 'error'
    >('loading');
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

    const computedThumbnailUrl = useMemo(() => {
      if (!canvas || !isVisible) return null;

      try {
        const thumb = Array.isArray(canvas.thumbnail)
          ? canvas.thumbnail[0]
          : canvas.thumbnail;
        if (thumb?.id || thumb?.['@id']) {
          const thumbUrl = thumb.id || thumb['@id'];
          return getProxiedUrl(thumbUrl);
        }

        const v3Service = canvas.items?.[0]?.items?.find(
          (anno: any) => anno.body?.service,
        )?.body.service;

        if (v3Service) {
          const srv = Array.isArray(v3Service) ? v3Service[0] : v3Service;
          const id = srv.id || srv['@id'];
          return id ? `${id}/full/!100,100/0/default.jpg` : null;
        }

        const v2Image = canvas.images?.[0];
        if (v2Image?.resource?.service) {
          const service = Array.isArray(v2Image.resource.service)
            ? v2Image.resource.service[0]
            : v2Image.resource.service;
          const id = service['@id'] || service.id;
          return id ? `${id}/full/!100,100/0/default.jpg` : null;
        }

        const v3ImgAnno = canvas.items?.[0]?.items?.find(
          (anno: any) =>
            anno.body?.id &&
            (anno.body.type === 'Image' || anno.motivation === 'painting'),
        );

        if (v3ImgAnno?.body?.id) {
          return getProxiedUrl(v3ImgAnno.body.id);
        }

        if (v2Image?.resource?.['@id'] || v2Image?.resource?.id) {
          const imageUrl = v2Image.resource['@id'] || v2Image.resource.id;
          return getProxiedUrl(imageUrl);
        }

        return null;
      } catch {
        return null;
      }
    }, [canvas, isVisible]);

    React.useEffect(() => {
      if (computedThumbnailUrl && computedThumbnailUrl !== thumbnailUrl) {
        setThumbnailUrl(computedThumbnailUrl);
        setImageState('loading');
      }
    }, [computedThumbnailUrl, thumbnailUrl]);

    const handleImageLoad = useCallback(() => {
      setImageState('loaded');
    }, []);

    const handleImageError = useCallback(() => {
      setImageState('error');
    }, []);

    return (
      <div className="relative w-10 h-10 bg-muted/30 rounded-md overflow-hidden flex-shrink-0 border border-border">
        {thumbnailUrl && isVisible ? (
          <>
            {imageState === 'loading' && (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-3 h-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              </div>
            )}
            <img
              src={thumbnailUrl}
              alt=""
              className={cn(
                'w-full h-full object-cover transition-opacity duration-200',
                imageState === 'loaded' ? 'opacity-100' : 'opacity-0',
              )}
              loading="lazy"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
            {imageState === 'error' && (
              <div className="absolute inset-0 w-full h-full flex items-center justify-center text-xs text-muted-foreground bg-muted/30">
                No preview
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            {isVisible ? 'No preview' : '...'}
          </div>
        )}
        <div className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] px-1 rounded-tl">
          {index + 1}
        </div>
      </div>
    );
  },
);

CanvasThumbnail.displayName = 'CanvasThumbnail';

const MetadataItem = memo(
  ({
    icon: Icon,
    label,
    value,
  }: {
    icon: React.ComponentType<any>;
    label: string;
    value: string;
  }) => (
    <div
      className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-hidden"
      title={`${label}: ${value}`}
    >
      <Icon className="h-3 w-3 flex-shrink-0" />
      <span className="truncate text-ellipsis overflow-hidden">{value}</span>
    </div>
  ),
);

MetadataItem.displayName = 'MetadataItem';

export const CollectionSidebar = memo(
  ({ manifest, currentCanvas, onCanvasSelect }: CollectionSidebarProps) => {
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
    const containerRef = useRef<HTMLDivElement>(null);

    const canvases = useMemo(() => getManifestCanvases(manifest), [manifest]);

    const isGeoreferenced = useCallback((canvas: any): boolean => {
      return !!(
        canvas.navPlace?.features?.length > 0 ||
        canvas.annotations?.some((page: any) =>
          page.id?.toLowerCase().includes('georeferencing'),
        )
      );
    }, []);

    const hasAnnotations = useCallback((canvas: any): boolean => {
      const hasItems = canvas.items
        ?.flatMap((page: any) => page.items ?? [])
        .some((anno: any) => anno.motivation === 'painting');

      const hasAnnotationPages = canvas.annotations?.some((page: any) =>
        page.items?.some((anno: any) => Boolean(anno.motivation)),
      );

      return hasItems || hasAnnotationPages;
    }, []);

    const getCanvasMetadata = useCallback((canvas: any) => {
      if (!canvas.metadata) return {};

      const metadata: any = {};
      canvas.metadata.forEach((item: any) => {
        const key = getLocalizedValue(item.label);
        const value = getLocalizedValue(item.value);
        if (key && value) {
          metadata[key] = value;
        }
      });
      return metadata;
    }, []);

    const formatDimensions = useCallback((canvas: any) => {
      return canvas.width && canvas.height
        ? `${canvas.width} × ${canvas.height}px`
        : null;
    }, []);

    const handleCanvasSelect = useCallback(
      (index: number) => {
        onCanvasSelect(index);
      },
      [onCanvasSelect],
    );

    const handleScroll = useCallback(
      (e: React.UIEvent<HTMLDivElement>) => {
        if (canvases.length <= 50) return;

        const container = e.currentTarget;
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        const itemHeight = 64;

        const start = Math.max(0, Math.floor(scrollTop / itemHeight) - 5);
        const end = Math.min(
          canvases.length,
          start + Math.ceil(containerHeight / itemHeight) + 10,
        );

        setVisibleRange({ start, end });
      },
      [canvases.length],
    );

    React.useEffect(() => {
      if (
        currentCanvas >= visibleRange.start &&
        currentCanvas <= visibleRange.end
      )
        return;

      const buffer = 10;
      const start = Math.max(0, currentCanvas - buffer);
      const end = Math.min(canvases.length, currentCanvas + buffer);
      setVisibleRange({ start, end });
    }, [currentCanvas, canvases.length, visibleRange.start, visibleRange.end]);

    const renderCanvases = useMemo(() => {
      const renderRange =
        canvases.length > 50
          ? visibleRange
          : { start: 0, end: canvases.length };

      return canvases
        .slice(renderRange.start, renderRange.end)
        .map((canvas: any, relativeIndex: number) => {
          const index = renderRange.start + relativeIndex;
          const isGeo = isGeoreferenced(canvas);
          const hasAnno = hasAnnotations(canvas);
          const isSelected = index === currentCanvas;
          const label = getLocalizedValue(canvas.label) || `Image ${index + 1}`;
          const metadata = getCanvasMetadata(canvas);
          const dimensions = formatDimensions(canvas);
          const isVisible =
            index >= visibleRange.start && index <= visibleRange.end;

          return (
            <li key={index}>
              <div
                className={cn(
                  'group flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all',
                  'border border-border hover:border-border hover:bg-sidebar-accent',
                  'focus-within:outline-none focus-within:ring-2 focus-within:ring-sidebar-ring',
                  isSelected && 'bg-primary/10 border-primary/30 shadow-sm',
                )}
                onClick={() => handleCanvasSelect(index)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCanvasSelect(index);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`Select ${label}${isGeo ? ', georeferenced' : ''}${
                  hasAnno ? ', annotated' : ''
                }`}
              >
                <CanvasThumbnail
                  canvas={canvas}
                  index={index}
                  isVisible={isVisible}
                />

                <div className="flex-1 min-w-0 space-y-1 overflow-hidden max-w-[calc(100%-3rem)]">
                  <h3 className="text-sm font-medium leading-tight line-clamp-2 break-words text-sidebar-foreground overflow-hidden">
                    {label}
                  </h3>

                  {(dimensions ||
                    metadata.Date ||
                    metadata.Author ||
                    metadata.Publisher ||
                    metadata.Scale) && (
                    <div className="space-y-0.5">
                      {dimensions && (
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {dimensions}
                        </div>
                      )}
                      {metadata.Date && (
                        <MetadataItem
                          icon={Calendar}
                          label="Date"
                          value={metadata.Date}
                        />
                      )}
                      {metadata.Author && (
                        <MetadataItem
                          icon={User}
                          label="Author"
                          value={metadata.Author}
                        />
                      )}
                      {metadata.Publisher && (
                        <MetadataItem
                          icon={Building}
                          label="Publisher"
                          value={metadata.Publisher}
                        />
                      )}
                      {metadata.Scale && (
                        <MetadataItem
                          icon={Ruler}
                          label="Scale"
                          value={metadata.Scale}
                        />
                      )}
                    </div>
                  )}

                  {(isGeo || hasAnno) && (
                    <div className="flex gap-1 flex-wrap">
                      {isGeo && (
                        <Badge
                          variant="outline"
                          className="text-[9px] py-0.5 h-auto flex items-center gap-0.5 border-border text-foreground bg-muted/30"
                        >
                          <Map className="h-2 w-2" />
                          Geo
                        </Badge>
                      )}
                      {hasAnno && (
                        <Badge
                          variant="outline"
                          className="text-[9px] py-0.5 h-auto flex items-center gap-0.5 border-border text-foreground bg-muted/30"
                        >
                          <MessageSquare className="h-2 w-2" />
                          Anno
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        });
    }, [
      canvases,
      visibleRange,
      currentCanvas,
      isGeoreferenced,
      hasAnnotations,
      getCanvasMetadata,
      formatDimensions,
      handleCanvasSelect,
    ]);

    return (
      <aside className="bg-sidebar-background border-r border-sidebar-border flex flex-col h-full">
        <div className="p-4 border-b border-sidebar-border bg-sidebar-accent">
          <h2 className="text-lg font-semibold text-sidebar-foreground">
            Collection
          </h2>
          <p className="text-sm text-muted-foreground">
            {canvases.length} {canvases.length === 1 ? 'item' : 'items'}
          </p>
        </div>

        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-sidebar-background"
          onScroll={handleScroll}
        >
          <ul className="p-2 space-y-1.5">{renderCanvases}</ul>
        </div>
      </aside>
    );
  },
);

CollectionSidebar.displayName = 'CollectionSidebar';
