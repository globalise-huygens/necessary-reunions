'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { ScrollArea } from '@/components/ScrollArea';
import { Map, MessageSquare } from 'lucide-react';

interface CollectionViewProps {
  manifest: any;
  currentCanvas: number;
  onCanvasSelect: (index: number) => void;
  onImageDoubleClick?: () => void;
}

export function CollectionView({
  manifest,
  currentCanvas,
  onCanvasSelect,
  onImageDoubleClick,
}: CollectionViewProps) {
  const [hoveredCanvas, setHoveredCanvas] = useState<number | null>(null);

  const canvases = manifest.items || [];

  const hasGeoData = (canvas: any): boolean => {
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

    if (canvas.thumbnail) {
      const thumb = Array.isArray(canvas.thumbnail)
        ? canvas.thumbnail[0]
        : canvas.thumbnail;
      return thumb.id || thumb['@id'] || null;
    }

    if (canvas.items && canvas.items[0] && canvas.items[0].items) {
      for (const anno of canvas.items[0].items) {
        if (anno.body && anno.body.service) {
          const service = Array.isArray(anno.body.service)
            ? anno.body.service[0]
            : anno.body.service;
          const serviceId = service.id || service['@id'];
          if (serviceId) {
            return `${serviceId}/full/!200,200/0/default.jpg`;
          }
        }
      }
    }

    return null;
  };

  const getCanvasLabel = (canvas: any, index: number): string => {
    if (!canvas) return `Image ${index + 1}`;

    if (canvas.label) {
      const label = canvas.label.en || Object.values(canvas.label)[0];
      if (Array.isArray(label) && label.length > 0) {
        return label[0];
      }
      if (typeof label === 'string') {
        return label;
      }
    }

    return `Image ${index + 1}`;
  };

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-medium mb-4">
          Collection Images ({canvases.length})
        </h3>

        <ScrollArea className="h-[600px]">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {canvases.map((canvas: any, index: number) => {
              const thumbnailUrl = getThumbnailUrl(canvas);
              const isGeoReferenced = hasGeoData(canvas);
              const hasAnno = hasAnnotations(canvas);
              const isSelected = index === currentCanvas;
              const isHovered = index === hoveredCanvas;

              return (
                <div
                  key={index}
                  className={`
                    relative rounded-md overflow-hidden cursor-pointer transition-all
                    ${
                      isSelected
                        ? 'ring-2 ring-primary ring-offset-2'
                        : 'hover:ring-1 hover:ring-primary/50'
                    }
                  `}
                  onClick={() => onCanvasSelect(index)}
                  onDoubleClick={() => {
                    onCanvasSelect(index);
                    if (onImageDoubleClick) onImageDoubleClick();
                  }}
                  onMouseEnter={() => setHoveredCanvas(index)}
                  onMouseLeave={() => setHoveredCanvas(null)}
                >
                  <div className="aspect-square bg-muted/20 relative">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl || '/placeholder.svg'}
                        alt={getCanvasLabel(canvas, index)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No thumbnail
                      </div>
                    )}

                    <div className="absolute top-2 right-2 flex gap-1">
                      {isGeoReferenced && (
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1 bg-white/90"
                        >
                          <Map className="h-3 w-3" />
                        </Badge>
                      )}
                      {hasAnno && (
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1 bg-white/90"
                        >
                          <MessageSquare className="h-3 w-3" />
                        </Badge>
                      )}
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center">
                      {index + 1}
                    </div>

                    {(isHovered || isSelected) && (
                      <div className="absolute inset-0 bg-black/40 flex items-end p-2">
                        <div className="text-white text-sm font-medium line-clamp-2">
                          {getCanvasLabel(canvas, index)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
