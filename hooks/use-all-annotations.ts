import { useEffect, useState, useCallback, useRef } from 'react';
import type { Annotation } from '@/lib/types';
import { fetchAnnotations } from '@/lib/annoRepo';

export function useAllAnnotations(canvasId: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchIdRef = useRef(0);

  const etagCache = useRef<Record<string, string>>({});

  const fetchAll = useCallback(
    async (currentFetchId: number) => {
      let all: Annotation[] = [];
      let page = 0;
      let more = true;
      let firstPageLoaded = false;
      // 1. Fetch all annotations for the canvas
      while (more) {
        try {
          const { items, hasMore } = await fetchAnnotations({
            targetCanvasId: canvasId,
            page,
          });
          items.forEach((item: any) => {
            if ((item as any).etag && item.id)
              etagCache.current[item.id] = (item as any).etag;
          });
          all.push(...items);
          more = hasMore;
          page++;
          if (!firstPageLoaded) {
            setAnnotations([...all]);
            setIsLoading(false);
            firstPageLoaded = true;
          }
        } catch (err) {
          console.error('Error loading annotations:', err);
          break;
        }
      }
      // 2. Fetch linking annotations for each annotation ID
      const annotationIds = all.map((a) => a.id).filter(Boolean);
      const linkingAnnos: Annotation[] = [];
      if (annotationIds.length > 0) {
        // Batch fetch for all annotation IDs (in groups of 10 to avoid too many requests)
        const BATCH_SIZE = 10;
        for (let i = 0; i < annotationIds.length; i += BATCH_SIZE) {
          const batch = annotationIds.slice(i, i + BATCH_SIZE);
          // For each batch, fetch linking annotations
          const batchResults = await Promise.all(
            batch.map((annoId) =>
              fetchAnnotations({ targetCanvasId: annoId, page: 0 })
                .then((res) =>
                  res.items.filter((a) => a.motivation === 'linking'),
                )
                .catch(() => []),
            ),
          );
          batchResults.forEach((items) => linkingAnnos.push(...items));
        }
      }
      // 3. Merge and deduplicate all annotations by id, but always keep the first occurrence (canvas annotations first)
      const allWithLinks = [...all, ...linkingAnnos];
      const deduped: Annotation[] = [];
      const seen = new Set<string>();
      for (const anno of allWithLinks) {
        if (anno.id && !seen.has(anno.id)) {
          deduped.push(anno);
          seen.add(anno.id);
        }
      }
      // If deduped is missing any canvas annotation, add it
      for (const anno of all) {
        if (anno.id && !seen.has(anno.id)) {
          deduped.push(anno);
          seen.add(anno.id);
        }
      }
      setAnnotations(deduped);
      setIsLoading(false);
    },
    [canvasId],
  );

  const getEtag = useCallback((id: string) => etagCache.current[id], []);

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

  return {
    annotations,
    isLoading,
    refresh,
    addAnnotation,
    removeAnnotation,
    getEtag,
  };
}
