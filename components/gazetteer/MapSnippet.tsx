'use client';

import { AlertCircle, Image as ImageIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface MapSnippetProps {
  svgSelector: string;
  canvasUrl: string;
  text: string;
  source: 'human' | 'ai-pipeline' | 'loghi-htr';
  motivation?: 'textspotting' | 'iconography';
}

export function MapSnippet({
  svgSelector,
  canvasUrl,
  text,
  source,
  motivation = 'textspotting',
}: MapSnippetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const extractSnippet = async () => {
      if (!canvasRef.current) return;

      try {
        setIsLoading(true);
        setError(null);

        const polygonMatch = svgSelector.match(/points="([^"]+)"/);
        if (!polygonMatch || !polygonMatch[1]) {
          throw new Error('Invalid SVG selector');
        }

        const points = polygonMatch[1]
          .trim()
          .split(/\s+/)
          .map((pt) => {
            const coords = pt.split(',').map(Number);
            const x = coords[0];
            const y = coords[1];
            if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) {
              throw new Error('Invalid coordinates');
            }
            return { x, y };
          });

        if (points.length < 3) {
          throw new Error('Not enough points for polygon');
        }

        const minX = Math.min(...points.map((p) => p.x));
        const maxX = Math.max(...points.map((p) => p.x));
        const minY = Math.min(...points.map((p) => p.y));
        const maxY = Math.max(...points.map((p) => p.y));

        const width = maxX - minX;
        const height = maxY - minY;

        const padding = 10;
        const snippetWidth = width + padding * 2;
        const snippetHeight = height + padding * 2;

        // Fetch the manifest to get the actual IIIF image service URL
        const manifestUrl = canvasUrl.replace(/\/canvas\/.*$/, '');

        const manifestResponse = await fetch(manifestUrl);
        if (!manifestResponse.ok) {
          throw new Error('Failed to fetch manifest');
        }

        const manifest = await manifestResponse.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const canvas = manifest.items?.[0];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const imageService = canvas?.items?.[0]?.items?.[0]?.body?.service?.[0];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const imageServiceUrl = (imageService?.['@id'] ||
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          imageService?.id) as string;

        if (!imageServiceUrl) {
          throw new Error('No IIIF image service found in manifest');
        }

        // Get image dimensions from manifest canvas
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const imageWidth = canvas?.width as number;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const imageHeight = canvas?.height as number;

        const regionX = Math.max(0, minX - padding);
        const regionY = Math.max(0, minY - padding);
        const regionW = Math.min(imageWidth - regionX, snippetWidth);
        const regionH = Math.min(imageHeight - regionY, snippetHeight);

        const maxSize = 400;
        const scale = Math.min(maxSize / regionW, maxSize / regionH, 1);
        const targetW = Math.round(regionW * scale);
        const targetH = Math.round(regionH * scale);

        const imageUrl = `${imageServiceUrl}/${regionX},${regionY},${regionW},${regionH}/${targetW},${targetH}/0/default.jpg`;

        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          if (!isMounted || !canvasRef.current) return;

          const canvasElement = canvasRef.current;
          const ctx = canvasElement.getContext('2d');
          if (!ctx) return;

          canvasElement.width = img.width;
          canvasElement.height = img.height;

          ctx.drawImage(img, 0, 0);

          // Color coding using design system: chart-1 for human, chart-2 for icons, chart-3 for AI
          ctx.strokeStyle =
            source === 'human'
              ? 'hsl(12 76% 61% / 0.9)' // chart-1 (warm orange)
              : motivation === 'iconography'
                ? 'hsl(173 58% 39% / 0.9)' // chart-2 (teal)
                : 'hsl(197 37% 24% / 0.9)'; // chart-3 (dark blue)
          ctx.lineWidth = 2;
          ctx.beginPath();

          const scaledPoints = points.map((p) => ({
            x: (p.x - regionX) * scale,
            y: (p.y - regionY) * scale,
          }));

          const firstPoint = scaledPoints[0];
          if (!firstPoint) return;

          ctx.moveTo(firstPoint.x, firstPoint.y);
          for (let i = 1; i < scaledPoints.length; i++) {
            const point = scaledPoints[i];
            if (point) {
              ctx.lineTo(point.x, point.y);
            }
          }
          ctx.closePath();
          ctx.stroke();

          setIsLoading(false);
        };

        img.onerror = () => {
          if (!isMounted) return;
          setError('Failed to load map image');
          setIsLoading(false);
        };

        img.src = imageUrl;
      } catch (err) {
        if (!isMounted) return;
        setError(
          err instanceof Error ? err.message : 'Failed to extract snippet',
        );
        setIsLoading(false);
      }
    };

    extractSnippet().catch(() => {
      if (isMounted) {
        setError('Unexpected error');
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [svgSelector, canvasUrl, source, motivation]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-muted/20 rounded-lg border border-border min-h-[120px]">
        <AlertCircle className="w-6 h-6 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative group">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded-lg">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`rounded-lg border border-border shadow-sm ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } transition-opacity duration-300`}
      />
      <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        <ImageIcon className="w-3 h-3 inline mr-1" />
        {text}
      </div>
    </div>
  );
}
