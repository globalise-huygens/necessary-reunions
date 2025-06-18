'use client';

import * as React from 'react';
import { ScrollArea } from '@/components/ScrollArea';
import { Badge } from '@/components/Badge';
import { Map, MessageSquare } from 'lucide-react';
import { getLocalizedValue, getManifestCanvases } from '@/lib/iiif-helpers';
import { cn } from '@/lib/utils';

interface CollectionSidebarProps {
  manifest: any;
  currentCanvas: number;
  onCanvasSelect: (index: number) => void;
}

export function CollectionSidebar({
  manifest,
  currentCanvas,
  onCanvasSelect,
}: CollectionSidebarProps) {
  const canvases = getManifestCanvases(manifest);

  const isGeoreferenced = (canvas: any): boolean => {
    if (canvas.navPlace?.features?.length > 0) {
      return true;
    }
    return !!canvas.annotations?.some((page: any) =>
      page.id?.toLowerCase().includes('georeferencing'),
    );
  };

  const hasAnnotations = (canvas: any): boolean => {
    const pageItems = canvas.items
      ?.flatMap((page: any) => page.items ?? [])
      .filter(Boolean);

    if (pageItems?.some((anno: any) => anno.motivation === 'painting')) {
      return true;
    }

    return !!canvas.annotations?.some((page: any) =>
      page.items?.some((anno: any) => Boolean(anno.motivation)),
    );
  };

  const getThumbnailUrl = (canvas: any): string | null => {
    if (!canvas) return null;
    try {
      // Check for explicit thumbnail
      const thumb = Array.isArray(canvas.thumbnail)
        ? canvas.thumbnail[0]
        : canvas.thumbnail;
      if (thumb?.id || thumb?.['@id']) return thumb.id || thumb['@id'];

      // IIIF v3 service extraction
      const v3Service = canvas.items?.[0]?.items?.find(
        (anno: any) => anno.body?.service,
      )?.body.service;

      if (v3Service) {
        const srv = Array.isArray(v3Service) ? v3Service[0] : v3Service;
        const id = srv.id || srv['@id'];
        return id ? `${id}/full/!100,100/0/default.jpg` : null;
      }

      // IIIF v2 service extraction
      const v2Image = canvas.images?.[0];
      if (v2Image?.resource?.service) {
        const service = Array.isArray(v2Image.resource.service)
          ? v2Image.resource.service[0]
          : v2Image.resource.service;
        const id = service['@id'] || service.id;
        return id ? `${id}/full/!100,100/0/default.jpg` : null;
      }

      // Fallback to direct image URL
      const v3ImgAnno = canvas.items?.[0]?.items?.find(
        (anno: any) =>
          anno.body?.id &&
          (anno.body.type === 'Image' || anno.motivation === 'painting'),
      );

      if (v3ImgAnno?.body?.id) return v3ImgAnno.body.id;

      // IIIF v2 direct image
      if (v2Image?.resource?.['@id'] || v2Image?.resource?.id) {
        return v2Image.resource['@id'] || v2Image.resource.id;
      }

      return null;
    } catch {
      return null;
    }
  };

  const getCanvasMetadata = (canvas: any) => {
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
  };

  const formatDimensions = (canvas: any) => {
    if (canvas.width && canvas.height) {
      return `${canvas.width} × ${canvas.height}px`;
    }
    return null;
  };

  return (
    <>
      <div className="p-3 border-b bg-muted/30">
        <h3 className="font-medium text-sm">Images ({canvases.length})</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {canvases.map((canvas: any, index: number) => {
            const thumbnailUrl = getThumbnailUrl(canvas);
            const isGeo = isGeoreferenced(canvas);
            const hasAnno = hasAnnotations(canvas);
            const isSelected = index === currentCanvas;
            const label =
              getLocalizedValue(canvas.label) || `Image ${index + 1}`;
            const metadata = getCanvasMetadata(canvas);
            const dimensions = formatDimensions(canvas);

            return (
              <div
                key={index}
                className={cn(
                  'flex items-start gap-3 p-2 rounded-md cursor-pointer',
                  isSelected
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-muted',
                )}
                onClick={() => onCanvasSelect(index)}
              >
                <div className="w-12 h-12 bg-muted/50 flex-shrink-0 rounded overflow-hidden relative">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                      No thumb
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center">
                    {index + 1}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium break-words line-clamp-2 leading-tight mb-1">
                    {label}
                  </div>

                  {/* Additional metadata information */}
                  <div className="space-y-1">
                    {dimensions && (
                      <div className="text-xs text-muted-foreground">
                        {dimensions}
                      </div>
                    )}

                    {metadata.Date && (
                      <div className="text-xs text-muted-foreground">
                        📅 {metadata.Date}
                      </div>
                    )}

                    {metadata.Author && (
                      <div className="text-xs text-muted-foreground truncate">
                        👤 {metadata.Author}
                      </div>
                    )}

                    {metadata.Publisher && (
                      <div className="text-xs text-muted-foreground truncate">
                        🏢 {metadata.Publisher}
                      </div>
                    )}

                    {metadata.Scale && (
                      <div className="text-xs text-muted-foreground">
                        📏 {metadata.Scale}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 mt-2">
                    {isGeo && (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 h-4 flex items-center gap-1"
                      >
                        <Map className="h-2.5 w-2.5" />
                        Geo
                      </Badge>
                    )}
                    {hasAnno && (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 h-4 flex items-center gap-1"
                      >
                        <MessageSquare className="h-2.5 w-2.5" />
                        Anno
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </>
  );
}
