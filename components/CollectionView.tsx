/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

'use client';

import { Map, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../components/shared/Badge';
import { Card, CardContent } from '../components/shared/Card';
import { ScrollArea } from '../components/shared/ScrollArea';
import { cn } from '../lib/shared/utils';
import {
  getLocalizedValue,
  getManifestCanvases,
} from '../lib/viewer/iiif-helpers';

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
  const [hovered, setHovered] = useState<number | null>(null);
  const canvases = getManifestCanvases(manifest);

  const hasGeo = (canvas: any) =>
    !!canvas?.annotations?.some((page: any) =>
      page.items?.some(
        (a: any) =>
          a.motivation === 'georeferencing' ||
          a.body?.type === 'GeoJSON' ||
          a.target?.selector?.type === 'GeoJSON',
      ),
    );

  const hasAnno = (canvas: any) =>
    !!canvas?.annotations?.some((page: any) =>
      page.items?.some(
        (a: any) =>
          a.motivation &&
          !(
            a.body?.service &&
            (a.body.type === 'Image' || a.motivation === 'painting')
          ),
      ),
    );

  const getThumb = (canvas: any): string | null => {
    const thumb = Array.isArray(canvas?.thumbnail)
      ? canvas.thumbnail[0]
      : canvas.thumbnail;
    if (thumb?.id || thumb?.['@id']) return thumb.id || thumb['@id'];
    const service = canvas.items?.[0]?.items?.find((a: any) => a.body?.service)
      ?.body.service;
    if (service) {
      const srv = Array.isArray(service) ? service[0] : service;
      const id = srv.id || srv['@id'];
      return id ? `${id}/full/!200,200/0/default.jpg` : null;
    }
    return null;
  };

  const getLabel = (canvas: any, idx: number) => {
    const raw = getLocalizedValue(canvas.label);
    return raw || `Image ${idx + 1}`;
  };

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-medium mb-4">
          Collection Images ({canvases.length})
        </h3>
        <ScrollArea className="h-[600px]">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {canvases.map((canvas: any, idx: number) => {
              const thumb = getThumb(canvas);
              const geo = hasGeo(canvas);
              const anno = hasAnno(canvas);
              const selected = idx === currentCanvas;
              const hover = idx === hovered;
              const label = getLabel(canvas, idx);
              const canvasId = canvas?.id || canvas?.['@id'] || idx;

              const handleClick = () => onCanvasSelect(idx);
              const handleDblClick = () => {
                onCanvasSelect(idx);
                onImageDoubleClick?.();
              };

              return (
                <button
                  key={`canvas-${canvasId}`}
                  type="button"
                  className={cn(
                    'relative rounded-md overflow-hidden cursor-pointer transition-all',
                    selected
                      ? 'ring-2 ring-primary ring-offset-2'
                      : 'hover:ring-1 hover:ring-primary/50',
                  )}
                  onClick={handleClick}
                  onDoubleClick={handleDblClick}
                  onMouseEnter={() => setHovered(idx)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="aspect-square bg-muted/20 relative">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                        No thumbnail
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1">
                      {geo && (
                        <Badge variant="secondary" className="bg-white/90">
                          <Map className="h-3 w-3" />
                        </Badge>
                      )}
                      {anno && (
                        <Badge variant="secondary" className="bg-white/90">
                          <MessageSquare className="h-3 w-3" />
                        </Badge>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center">
                      {idx + 1}
                    </div>
                    {(hover || selected) && (
                      <div className="absolute inset-0 bg-black/40 flex items-end p-2">
                        <div className="text-white text-sm font-medium line-clamp-2">
                          {label}
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
