'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Map, MessageSquare } from 'lucide-react';
import { getLocalizedValue } from '@/lib/iiif-helpers';

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
    if (!canvas || !canvas.annotations) return false;

    for (const annoPage of canvas.annotations) {
      if (!annoPage.items) continue;

      for (const anno of annoPage.items) {
        if (
          anno.motivation === 'georeferencing' ||
          (anno.body && anno.body.type === 'GeoJSON') ||
          (anno.target &&
            anno.target.selector &&
            anno.target.selector.type === 'GeoJSON')
        ) {
          return true;
        }
      }
    }
    return false;
  };

  const hasAnnotations = (canvas: any): boolean => {
    if (!canvas || !canvas.annotations) return false;

    for (const annoPage of canvas.annotations) {
      if (!annoPage.items) continue;

      for (const anno of annoPage.items) {
        if (
          anno.body &&
          anno.body.service &&
          (anno.body.type === 'Image' || anno.motivation === 'painting')
        ) {
          continue;
        }

        if (anno.motivation) {
          return true;
        }
      }
    }
    return false;
  };

  const getThumbnailUrl = (canvas: any): string | null => {
    if (!canvas) return null;

    try {
      if (canvas.thumbnail) {
        const thumb = Array.isArray(canvas.thumbnail)
          ? canvas.thumbnail[0]
          : canvas.thumbnail;
        return thumb.id || thumb['@id'] || null;
      }

      if (canvas.items && canvas.items[0] && canvas.items[0].items) {
        for (const anno of canvas.items[0].items) {
          if (anno.body) {
            if (anno.body.service) {
              const service = Array.isArray(anno.body.service)
                ? anno.body.service[0]
                : anno.body.service;
              const serviceId = service.id || service['@id'];
              if (serviceId) {
                return `${serviceId}/full/!100,100/0/default.jpg`;
              }
            } else if (
              anno.body.id &&
              (anno.body.type === 'Image' || anno.motivation === 'painting')
            ) {
              return anno.body.id;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error getting thumbnail URL:', error);
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
            const isGeoRef = isGeoreferenced(canvas);
            const hasAnno = hasAnnotations(canvas);
            const isSelected = index === currentCanvas;
            const label =
              getLocalizedValue(canvas.label) || `Image ${index + 1}`;

            return (
              <div
                key={index}
                className={`
                  flex items-center gap-3 p-2 rounded-md cursor-pointer
                  ${
                    isSelected
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-muted'
                  }
                `}
                onClick={() => onCanvasSelect(index)}
              >
                <div className="w-12 h-12 bg-muted/50 flex-shrink-0 rounded overflow-hidden relative">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl || '/placeholder.svg'}
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
                    {isGeoRef && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4">
                        <Map className="h-2.5 w-2.5 mr-1" />
                        Geo
                      </Badge>
                    )}
                    {hasAnno && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4">
                        <MessageSquare className="h-2.5 w-2.5 mr-1" />
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
