'use client';

import * as React from 'react';
import { ScrollArea } from '@/components/ScrollArea';
import { Badge } from '@/components/Badge';
import { Map, MessageSquare } from 'lucide-react';
import { getLocalizedValue } from '@/lib/iiif-helpers';
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
  const canvases = manifest.items || [];

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
      const thumb = Array.isArray(canvas.thumbnail)
        ? canvas.thumbnail[0]
        : canvas.thumbnail;
      if (thumb?.id || thumb?.['@id']) return thumb.id || thumb['@id'];

      const service = canvas.items?.[0]?.items?.find(
        (anno: any) => anno.body?.service,
      )?.body.service;

      if (service) {
        const srv = Array.isArray(service) ? service[0] : service;
        const id = srv.id || srv['@id'];
        return id ? `${id}/full/!100,100/0/default.jpg` : null;
      }

      const imgAnno = canvas.items?.[0]?.items?.find(
        (anno: any) =>
          anno.body?.id &&
          (anno.body.type === 'Image' || anno.motivation === 'painting'),
      );
      return imgAnno?.body?.id || null;
    } catch {
      return null;
    }
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

            return (
              <div
                key={index}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-md cursor-pointer',
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
                  <div className="text-sm font-medium break-words line-clamp-2 leading-tight">
                    {label}
                  </div>
                  <div className="flex gap-1 mt-1">
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
