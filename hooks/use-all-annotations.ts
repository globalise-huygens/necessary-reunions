import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import type { Annotation } from '@/lib/types';
import { fetchAnnotations } from '@/lib/annoRepo';
import { usePerformanceMonitor } from './use-performance-monitor';

class AnnotationCache {
  private annotations: Map<string, Annotation> = new Map();
  private linkingAnnotations: Map<string, Annotation> = new Map();
  private etags: Map<string, string> = new Map();
  private lastUpdate = 0;

  setAnnotations(annotations: Annotation[]) {
    this.annotations.clear();
    annotations.forEach((anno) => {
      this.annotations.set(anno.id, anno);
      if ((anno as any).etag) {
        this.etags.set(anno.id, (anno as any).etag);
      }
    });
    this.lastUpdate = Date.now();
  }

  setLinkingAnnotations(linkingAnnos: Annotation[]) {
    this.linkingAnnotations.clear();
    linkingAnnos.forEach((anno) => {
      this.linkingAnnotations.set(anno.id, anno);
      if ((anno as any).etag) {
        this.etags.set(anno.id, (anno as any).etag);
      }
    });
  }

  getAllAnnotations(): Annotation[] {
    const all = new Map<string, Annotation>();

    for (const [id, anno] of this.annotations) {
      all.set(id, anno);
    }

    for (const [id, anno] of this.linkingAnnotations) {
      if (!all.has(id)) {
        all.set(id, anno);
      }
    }

    return Array.from(all.values());
  }

  getEtag(id: string): string | undefined {
    return this.etags.get(id);
  }

  addAnnotation(annotation: Annotation) {
    if (annotation.motivation === 'linking') {
      this.linkingAnnotations.set(annotation.id, annotation);
    } else {
      this.annotations.set(annotation.id, annotation);
    }

    if ((annotation as any).etag) {
      this.etags.set(annotation.id, (annotation as any).etag);
    }
    this.lastUpdate = Date.now();
  }

  removeAnnotation(annotationId: string) {
    this.annotations.delete(annotationId);
    this.linkingAnnotations.delete(annotationId);
    this.etags.delete(annotationId);
    this.lastUpdate = Date.now();
  }

  getLastUpdate(): number {
    return this.lastUpdate;
  }
}

export function useAllAnnotations(canvasId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLinkingLoading, setIsLinkingLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);
  const fetchIdRef = useRef(0);
  const cacheRef = useRef(new AnnotationCache());
  const { startTimer, endTimer, setMetric, logMetrics } =
    usePerformanceMonitor();

  const annotations = useMemo(() => {
    return cacheRef.current.getAllAnnotations();
  }, [lastUpdate]);

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

          all.push(...items);
          more = hasMore;
          page++;

          if (!firstPageLoaded) {
            cacheRef.current.setAnnotations([...all]);
            setLastUpdate(cacheRef.current.getLastUpdate());
            setIsLoading(false);
            firstPageLoaded = true;
          }

          if (fetchIdRef.current !== currentFetchId) {
            return;
          }
        } catch (err) {
          if (fetchIdRef.current === currentFetchId) {
            setIsLoading(false);
          }
          break;
        }
      }

      const loadTime = endTimer('annotationLoad');
      cacheRef.current.setAnnotations(all);
      setLastUpdate(cacheRef.current.getLastUpdate());
      setIsLoading(false);
      setMetric('annotationLoadTime', loadTime);
      setMetric('totalAnnotations', all.length);
    },
    [canvasId, startTimer, endTimer, setMetric],
  );

  // Fetch linking annotations with stable caching
  useEffect(() => {
    if (!annotations.length) {
      cacheRef.current.setLinkingAnnotations([]);
      setIsLinkingLoading(false);
      return;
    }

    let cancelled = false;
    setIsLinkingLoading(true);

    const fetchLinkingAnnotations = async (annotationIds: string[]) => {
      if (!annotationIds.length) {
        cacheRef.current.setLinkingAnnotations([]);
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
          const loadTime = endTimer('linkingLoad');
          cacheRef.current.setLinkingAnnotations(linking);
          setLastUpdate(cacheRef.current.getLastUpdate());
          setMetric('linkingLoadTime', loadTime);
          setMetric('linkingAnnotations', linking.length);
          logMetrics();
        }
      } catch (err) {
        endTimer('linkingLoad');
        if (!cancelled) {
          cacheRef.current.setLinkingAnnotations([]);
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
  }, [
    annotations.length,
    canvasId,
    startTimer,
    endTimer,
    setMetric,
    logMetrics,
  ]);

  const getEtag = useCallback((id: string) => cacheRef.current.getEtag(id), []);

  const refresh = useCallback(() => {
    if (!canvasId) {
      cacheRef.current.setAnnotations([]);
      cacheRef.current.setLinkingAnnotations([]);
      setLastUpdate(cacheRef.current.getLastUpdate());
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchIdRef.current += 1;
    const currentFetchId = fetchIdRef.current;
    fetchAll(currentFetchId);
  }, [canvasId, fetchAll]);

  const addAnnotation = useCallback((annotation: Annotation) => {
    cacheRef.current.addAnnotation(annotation);
    setLastUpdate(cacheRef.current.getLastUpdate());
  }, []);

  const removeAnnotation = useCallback((annotationId: string) => {
    cacheRef.current.removeAnnotation(annotationId);
    setLastUpdate(cacheRef.current.getLastUpdate());
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      refresh();
    }, 100);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  return {
    annotations,
    isLoading,
    isLinkingLoading,
    refresh,
    addAnnotation,
    removeAnnotation,
    getEtag,
  };
}
