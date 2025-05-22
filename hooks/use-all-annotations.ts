import { useEffect, useState, useCallback, useRef } from 'react';
import type { Annotation } from '@/lib/types';
import { fetchAnnotations } from '@/lib/annoRepo';

export function useAllAnnotations(canvasId: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchIdRef = useRef(0);

  const fetchAll = useCallback(
    async (currentFetchId: number) => {
      let all: Annotation[] = [];
      let page = 0;
      let more = true;
      while (more) {
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
      const annotationIds = all.map((a) => a.id).filter(Boolean);
      if (annotationIds.length > 0) {
        const { items: geotagItems } = await fetchAnnotations({
          targetCanvasId: canvasId,
          annotationIds,
        });
        for (const item of geotagItems) {
          if (!all.some((a) => a.id === item.id)) {
            all.push(item);
          }
        }
      }
      console.log('Fetched annotations from AnnoRepo (canvas+geotag):', all);
      if (fetchIdRef.current === currentFetchId) {
        setAnnotations(all);
        setIsLoading(false);
      }
    },
    [canvasId],
  );

  const refresh = useCallback(() => {
    if (!canvasId) {
      setAnnotations([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchIdRef.current += 1;
    const currentFetchId = fetchIdRef.current;
    fetchAll(currentFetchId);
  }, [canvasId, fetchAll]);

  const addAnnotation = useCallback(
    (annotation: Annotation) => {
      setAnnotations((prev) => {
        if (prev.some((a) => a.id === annotation.id)) return prev;
        return [...prev, annotation];
      });
      setTimeout(() => refresh(), 1000);
    },
    [refresh],
  );

  const removeAnnotation = useCallback(
    (annotationId: string) => {
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
      setTimeout(() => refresh(), 1000);
    },
    [refresh],
  );

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  return { annotations, isLoading, refresh, addAnnotation, removeAnnotation };
}
