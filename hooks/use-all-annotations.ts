import { fetchAnnotations } from '@/lib/annoRepo';
import type { Annotation } from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useAllAnnotations(canvasId: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // ETag cache: id -> etag
  const etagCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;

    if (!canvasId) {
      setAnnotations([]);
      setIsLoading(false);
      etagCache.current.clear();
      return;
    }

    setIsLoading(true);

    (async () => {
      let all: Annotation[] = [];
      let page = 0;
      let more = true;

      while (more && !cancelled) {
        try {
          const { items, hasMore } = await fetchAnnotations({
            targetCanvasId: canvasId,
            page,
          });
          // Store ETags if present
          items.forEach((anno: any) => {
            if (anno.etag) {
              etagCache.current.set(anno.id, anno.etag);
            }
          });
          all.push(...items);
          more = hasMore;
          page++;
        } catch (err) {
          console.error('Error loading remote annotations:', err);
          break;
        }
      }

      try {
        const localResponse = await fetch('/api/annotations/local');
        if (localResponse.ok) {
          const { annotations: localAnnotations } = await localResponse.json();
          if (Array.isArray(localAnnotations)) {
            const canvasLocalAnnotations = localAnnotations.filter(
              (annotation: any) => {
                const targetSource =
                  annotation.target?.source?.id || annotation.target?.source;
                return targetSource === canvasId;
              },
            );
            all.push(...canvasLocalAnnotations);
          }
        }
      } catch (err) {
        console.error('Error loading local annotations:', err);
      }

      if (!cancelled) {
        setAnnotations(all);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canvasId]);

  // Helper to get ETag for an annotation by id
  const getEtag = useCallback((id: string) => etagCache.current.get(id), []);

  return { annotations, isLoading, getEtag };
}
