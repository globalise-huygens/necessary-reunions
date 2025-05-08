import { useEffect, useState, useCallback } from 'react';
import type { Annotation } from '@/lib/types';
import { fetchAnnotations } from '@/lib/annoRepo';

export function useAllAnnotations(canvasId: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!canvasId) {
      setAnnotations([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    let all: Annotation[] = [];
    let page = 0,
      more = true;

    while (more) {
      try {
        const { items, hasMore } = await fetchAnnotations({
          targetCanvasId: canvasId,
          page,
        });
        all.push(...items);
        more = hasMore;
        page++;
      } catch {
        break;
      }
    }
    setAnnotations(all);
    setIsLoading(false);
  }, [canvasId]);

  useEffect(() => {
    load();
  }, [load]);

  return { annotations, isLoading, reload: load };
}
