/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-use-before-define */

'use client';

import {
  Building,
  Calendar,
  Map,
  MessageSquare,
  Ruler,
  User,
} from 'lucide-react';
import * as React from 'react';
import { Badge } from '../../components/shared/Badge';
import { ScrollArea } from '../../components/shared/ScrollArea';
import { cn } from '../../lib/shared/utils';
import {
  getLocalizedValue,
  getManifestCanvases,
} from '../../lib/viewer/iiif-helpers';

const MetadataItem = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<any>;
  label: string;
  value: string;
}) => (
  <div
    className="flex items-center gap-1.5 text-xs text-muted-foreground"
    title={`${label}: ${value}`}
  >
    <Icon className="h-3 w-3 flex-shrink-0" />
    <span className="truncate">{value}</span>
  </div>
);

interface CollectionSidebarProps {
  manifest: any;
  currentCanvas: number;
  onCanvasSelect: (index: number) => void;
  projectSlug?: string;
}

interface CanvasItemProps {
  canvas: any;
  index: number;
  currentCanvas: number;
  onCanvasSelect: (index: number) => void;
  hasAnnotations: boolean;
}

const CanvasItem = React.memo(function CanvasItem({
  canvas,
  index,
  currentCanvas,
  onCanvasSelect,
  hasAnnotations: hasAnno,
}: CanvasItemProps) {
  const isGeoreferenced = (): boolean => {
    return !!(
      canvas.navPlace?.features?.length > 0 ||
      canvas.annotations?.some((page: any) =>
        page.id?.toLowerCase().includes('georeferencing'),
      )
    );
  };

  const getThumbnailUrl = (canvasParam: any): string | null => {
    if (!canvasParam) return null;

    try {
      const thumb = Array.isArray(canvasParam.thumbnail)
        ? canvasParam.thumbnail[0]
        : canvasParam.thumbnail;
      if (thumb?.id || thumb?.['@id']) {
        const thumbUrl = thumb.id || thumb['@id'];
        return getProxiedUrl(thumbUrl);
      }

      const v3Service = canvasParam.items?.[0]?.items?.find(
        (anno: any) => anno.body?.service,
      )?.body.service;

      if (v3Service) {
        const srv = Array.isArray(v3Service) ? v3Service[0] : v3Service;
        const id = srv.id || srv['@id'];
        return id ? `${id}/full/!100,100/0/default.jpg` : null;
      }

      const v2Image = canvasParam.images?.[0];
      if (v2Image?.resource?.service) {
        const service = Array.isArray(v2Image.resource.service)
          ? v2Image.resource.service[0]
          : v2Image.resource.service;
        const id = service['@id'] || service.id;
        return id ? `${id}/full/!100,100/0/default.jpg` : null;
      }

      const v3ImgAnno = canvasParam.items?.[0]?.items?.find(
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
  };

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

  const getCanvasMetadata = (canvasParam: any) => {
    if (!canvasParam.metadata) return {};

    const metadata: any = {};
    canvasParam.metadata.forEach((item: any) => {
      const key = getLocalizedValue(item.label);
      const value = getLocalizedValue(item.value);
      if (key && value) {
        metadata[key] = value;
      }
    });
    return metadata;
  };

  const formatDimensions = (canvasParam: any) => {
    return canvasParam.width && canvasParam.height
      ? `${canvasParam.width} × ${canvasParam.height}`
      : null;
  };

  const thumbnailUrl = getThumbnailUrl(canvas);
  const isGeo = isGeoreferenced();
  const isSelected = index === currentCanvas;
  const label = getLocalizedValue(canvas.label) || `Image ${index + 1}`;
  const metadata = getCanvasMetadata(canvas);
  const dimensions = formatDimensions(canvas);

  return (
    <li key={`canvas-${index}`}>
      <div
        className={cn(
          'group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all',
          'border border-transparent hover:border-border/50',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/20',
          isSelected && 'bg-primary/10 border-primary/30 shadow-sm',
        )}
        onClick={() => onCanvasSelect(index)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onCanvasSelect(index);
          }
        }}
        tabIndex={0}
        role="button"
        aria-pressed={isSelected}
        aria-label={`Select ${label}${isGeo ? ', georeferenced' : ''}${
          hasAnno ? ', annotated' : ''
        }`}
      >
        <div className="relative w-12 h-12 bg-muted/50 rounded-md overflow-hidden flex-shrink-0">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
              No preview
            </div>
          )}
          <div className="absolute bottom-0 right-0 bg-black/70 text-white text-[10px] px-1 rounded-tl">
            {index + 1}
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <h3 className="text-sm font-medium leading-tight line-clamp-2 break-words">
            {label}
          </h3>

          {(dimensions ||
            metadata.Date ||
            metadata.Author ||
            metadata.Publisher ||
            metadata.Scale) && (
            <div className="space-y-1">
              {dimensions && (
                <div className="text-xs text-muted-foreground font-mono">
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
            <div className="flex gap-1.5">
              {isGeo && (
                <Badge
                  variant="outline"
                  className="text-[10px] py-0.5 h-auto flex items-center gap-1"
                >
                  <Map className="h-2.5 w-2.5" />
                  Geo
                </Badge>
              )}
              {hasAnno && (
                <Badge
                  variant="outline"
                  className="text-[10px] py-0.5 h-auto flex items-center gap-1"
                >
                  <MessageSquare className="h-2.5 w-2.5" />
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

export function CollectionSidebar({
  manifest,
  currentCanvas,
  onCanvasSelect,
  projectSlug,
}: CollectionSidebarProps) {
  const canvases = getManifestCanvases(manifest);

  const [annotationMap, setAnnotationMap] = React.useState<
    Record<string, boolean>
  >({});

  React.useEffect(() => {
    let cancelled = false;

    const loadAllAnnotations = async () => {
      const map: Record<string, boolean> = {};

      canvases.forEach((canvas: any) => {
        const canvasId = canvas?.id;
        if (!canvasId) return;
        map[canvasId] = Array.isArray(canvas.annotations)
          ? canvas.annotations.length > 0
          : false;
      });

      try {
        const { fetchAnnotations } = await import('../../lib/viewer/annoRepo');

        const batchSize = 5;
        for (let i = 0; i < canvases.length; i += batchSize) {
          if (cancelled) break;

          const batch = canvases.slice(i, i + batchSize);
          const promises = batch.map(async (canvas: any) => {
            const canvasId = canvas?.id;
            if (!canvasId) return;

            try {
              const { items } = await fetchAnnotations({
                targetCanvasId: canvasId,
                page: 0,
                projectSlug,
              });
              map[canvasId] = map[canvasId] || items.length > 0;
            } catch {
              map[canvasId] = map[canvasId] || false;
            }
          });

          await Promise.all(promises);
        }
      } catch {}

      if (!cancelled) {
        setAnnotationMap(map);
      }
    };

    if (canvases.length > 0) {
      loadAllAnnotations().catch(() => {});
    } else {
      setAnnotationMap({});
    }

    return () => {
      cancelled = true;
    };
  }, [canvases]);

  return (
    <aside
      className="flex flex-col h-full"
      role="navigation"
      aria-label="Image collection"
    >
      <header className="p-3 border-b bg-muted/30">
        <h2 className="font-medium text-sm" id="collection-title">
          Images ({canvases.length})
        </h2>
      </header>

      <ScrollArea className="flex-1">
        <ul className="p-2 space-y-1" aria-labelledby="collection-title">
          {canvases.map((canvas: any, index: number) => (
            <CanvasItem
              key={`canvas-item-${canvas?.id || index}`}
              canvas={canvas}
              index={index}
              currentCanvas={currentCanvas}
              onCanvasSelect={onCanvasSelect}
              hasAnnotations={annotationMap[canvas?.id] || false}
            />
          ))}
        </ul>
      </ScrollArea>
    </aside>
  );
}
