import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import type { Annotation } from '@/lib/types';
import { fetchAnnotations } from '@/lib/annoRepo';
import { usePerformanceMonitor } from './use-performance-monitor';

export function useAllAnnotations(canvasId: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLinkingLoading, setIsLinkingLoading] = useState(false);
  const fetchIdRef = useRef(0);
  const etagCache = useRef<Record<string, string>>({});
  const [linkingAnnos, setLinkingAnnos] = useState<Annotation[]>([]);
  const { startTimer, endTimer, setMetric, logMetrics } =
    usePerformanceMonitor();

  const fetchAll = useCallback(
    async (currentFetchId: number) => {
      startTimer('annotationLoad');
      let all: Annotation[] = [];
      let page = 0;
      let more = true;
      let firstPageLoaded = false;
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

          if (fetchIdRef.current !== currentFetchId) {
            return;
          }
        } catch (err) {
          console.error('Error loading annotations:', err);
          if (fetchIdRef.current === currentFetchId) {
            setIsLoading(false);
          }
          break;
        }
      }
      const loadTime = endTimer('annotationLoad');
      setAnnotations(all);
      setIsLoading(false);
      setMetric('annotationLoadTime', loadTime);
      setMetric('totalAnnotations', all.length);
    },
    [canvasId, startTimer, endTimer, setMetric],
  );

  useEffect(() => {
    if (!annotations.length) {
      setLinkingAnnos([]);
      setIsLinkingLoading(false);
      return;
    }
    let cancelled = false;
    setIsLinkingLoading(true);

    const fetchLinkingAnnotations = async (annotationIds: string[]) => {
      if (!annotationIds.length) {
        setLinkingAnnos([]);
        setIsLinkingLoading(false);
        return;
      }
      startTimer('linkingLoad');
      try {
        const { items } = await fetchAnnotations({
          targetCanvasId: canvasId,
          annotationIds,
          page: 0,
        });
        if (!cancelled) {
          const linking = items.filter((a) => a.motivation === 'linking');
          linking.forEach((item: any) => {
            if ((item as any).etag && item.id) {
              etagCache.current[item.id] = (item as any).etag;
            }
          });
          const loadTime = endTimer('linkingLoad');
          setLinkingAnnos(linking);
          setMetric('linkingLoadTime', loadTime);
          setMetric('linkingAnnotations', linking.length);
          logMetrics();
        }
      } catch (err) {
        endTimer('linkingLoad');
        if (!cancelled) {
          console.error('Error loading linking annotations:', err);
          setLinkingAnnos([]);
        }
      } finally {
        if (!cancelled) {
          setIsLinkingLoading(false);
        }
      }
    };

    fetchLinkingAnnotations(annotations.map((a) => a.id).filter(Boolean));
    return () => {
      cancelled = true;
    };
  }, [annotations, canvasId]);

  const mergedAnnotations = useMemo(() => {
    const merged = [...annotations];
    const seen = new Set(merged.map((a) => a.id));
    for (const anno of linkingAnnos) {
      if (anno.id && !seen.has(anno.id)) {
        merged.push(anno);
        seen.add(anno.id);
      }
    }
    return merged;
  }, [annotations, linkingAnnos]);

  const getEtag = useCallback((id: string) => etagCache.current[id], []);

  const refresh = useCallback(() => {
    if (!canvasId) {
      setAnnotations([]);
      setIsLoading(false);
      setLinkingAnnos([]);
      return;
    }
    setIsLoading(true);
    fetchIdRef.current += 1;
    const currentFetchId = fetchIdRef.current;
    fetchAll(currentFetchId);
  }, [canvasId, fetchAll]);

  const addAnnotation = useCallback((annotation: Annotation) => {
    setAnnotations((prev) => {
      if (prev.some((a) => a.id === annotation.id)) return prev;
      return [...prev, annotation];
    });

    if (annotation.motivation === 'linking') {
      setLinkingAnnos((prev) => {
        if (prev.some((a) => a.id === annotation.id)) return prev;
        return [...prev, annotation];
      });
    }

    if ((annotation as any).etag && annotation.id) {
      etagCache.current[annotation.id] = (annotation as any).etag;
    }
  }, []);

  const removeAnnotation = useCallback((annotationId: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
    setLinkingAnnos((prev) => prev.filter((a) => a.id !== annotationId));

    if (etagCache.current[annotationId]) {
      delete etagCache.current[annotationId];
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      refresh();
    }, 100);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  return {
    annotations: mergedAnnotations,
    isLoading,
    isLinkingLoading,
    refresh,
    addAnnotation,
    removeAnnotation,
    getEtag,
  };
}
