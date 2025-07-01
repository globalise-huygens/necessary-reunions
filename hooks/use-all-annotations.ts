import { fetchAnnotations } from '@/lib/annoRepo';
import type { Annotation } from '@/lib/types';
import { useCallback, useEffect, useState } from 'react';

export function useAllAnnotations(canvasId: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!canvasId) {
      setAnnotations([]);
      setIsLoading(false);
      return;
    }

    // Do NOT clear annotations here for better perceived performance
    setIsLoading(true);

    (async () => {
      let all: Annotation[] = [];
      let page = 0;
      let more = true;

      // First, fetch remote annotations from annorepo
      while (more && !cancelled) {
        try {
          const { items, hasMore } = await fetchAnnotations({
            targetCanvasId: canvasId,
            page,
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
            // Filter local annotations for this canvas
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

  return { annotations, isLoading };
}
