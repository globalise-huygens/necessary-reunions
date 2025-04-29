import { useEffect, useState } from 'react';
import type { Annotation } from '@/lib/types';
import { fetchAnnotations } from '@/lib/annoRepo';

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

    setAnnotations([]);
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
          all.push(...items);
          more = hasMore;
          page++;
        } catch (err) {
          console.error('Error loading annotations:', err);
          break;
        }
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
