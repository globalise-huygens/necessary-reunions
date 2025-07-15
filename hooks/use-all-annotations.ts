import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import type { Annotation } from '@/lib/types';
import { fetchAnnotations } from '@/lib/annoRepo';
import { usePerformanceMonitor } from './use-performance-monitor';

class AnnotationCache {
  private annotations: Map<string, Annotation> = new Map();
  private linkingAnnotations: Map<string, Annotation> = new Map();
  private etags: Map<string, string> = new Map();
  private lastUpdate = 0;
  private _allAnnotationsCache: Annotation[] | null = null;

  setAnnotations(annotations: Annotation[]) {
    this.annotations.clear();
    // Use batch operations for better performance
    const etagsToSet: Array<[string, string]> = [];

    annotations.forEach((anno) => {
      this.annotations.set(anno.id, anno);
      if ((anno as any).etag) {
        etagsToSet.push([anno.id, (anno as any).etag]);
      }
    });

    // Batch update etags
    etagsToSet.forEach(([id, etag]) => this.etags.set(id, etag));

    this.lastUpdate = Date.now();
    this._allAnnotationsCache = null; // Invalidate cache
  }

  setLinkingAnnotations(linkingAnnos: Annotation[]) {
    this.linkingAnnotations.clear();
    const etagsToSet: Array<[string, string]> = [];

    linkingAnnos.forEach((anno) => {
      this.linkingAnnotations.set(anno.id, anno);
      if ((anno as any).etag) {
        etagsToSet.push([anno.id, (anno as any).etag]);
      }
    });

    // Batch update etags
    etagsToSet.forEach(([id, etag]) => this.etags.set(id, etag));

    this._allAnnotationsCache = null; // Invalidate cache
  }

  getAllAnnotations(): Annotation[] {
    // Use cached result if available
    if (this._allAnnotationsCache) {
      return this._allAnnotationsCache;
    }

    const all = new Map<string, Annotation>();

    for (const [id, anno] of this.annotations) {
      all.set(id, anno);
    }

    for (const [id, anno] of this.linkingAnnotations) {
      if (!all.has(id)) {
        all.set(id, anno);
      }
    }

    this._allAnnotationsCache = Array.from(all.values());
    return this._allAnnotationsCache;
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
    this._allAnnotationsCache = null; // Invalidate cache
  }

  removeAnnotation(annotationId: string) {
    this.annotations.delete(annotationId);
    this.linkingAnnotations.delete(annotationId);
    this.etags.delete(annotationId);
    this.lastUpdate = Date.now();
    this._allAnnotationsCache = null; // Invalidate cache
  }

  getLastUpdate(): number {
    return this.lastUpdate;
  }
}

export function useAllAnnotations(canvasId: string, maxInitialLoad = 50) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLinkingLoading, setIsLinkingLoading] = useState(false);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const fetchIdRef = useRef(0);
  const cacheRef = useRef(new AnnotationCache());
  const { startTimer, endTimer, setMetric, logMetrics } =
    usePerformanceMonitor();

  const annotations = useMemo(() => {
    const allAnnotations = cacheRef.current.getAllAnnotations();
    console.log('useAllAnnotations: Returning annotations:', {
      canvasId,
      count: allAnnotations.length,
      lastUpdate,
      sampleAnnotations: allAnnotations
        .slice(0, 3)
        .map((a) => ({ id: a.id, motivation: a.motivation })),
    });
    return allAnnotations;
  }, [lastUpdate, canvasId]);

  const fetchAll = useCallback(
    async (currentFetchId: number, forceLoadAll = false) => {
      startTimer('annotationLoad');
      let all: Annotation[] = [];
      let page = 0;
      let more = true;
      let firstPageLoaded = false;

      try {
        // Load first page for fast initial rendering
        const { items: firstPageItems, hasMore: hasMoreAfterFirst } =
          await fetchAnnotations({
            targetCanvasId: canvasId,
            page: 0,
          });

        all.push(...firstPageItems);
        firstPageLoaded = true;
        page = 1;
        more = hasMoreAfterFirst;

        // If we have a small number of annotations or want to load only initial batch, stop here
        if (!forceLoadAll && firstPageItems.length <= maxInitialLoad) {
          cacheRef.current.setAnnotations([...all]);
          setLastUpdate(cacheRef.current.getLastUpdate());
          setIsLoading(false);

          const loadTime = endTimer('annotationLoad');
          setTotalAvailable(firstPageItems.length);
          console.log(
            `Quick load completed in ${Math.round(loadTime)}ms with ${
              firstPageItems.length
            } annotations`,
          );
          return;
        }

        // Immediately show first page results
        cacheRef.current.setAnnotations([...all]);
        setLastUpdate(cacheRef.current.getLastUpdate());
        setIsLoading(false);

        const firstPageLoadTime = endTimer('annotationLoad');
        console.log(
          `Initial load completed in ${Math.round(firstPageLoadTime)}ms with ${
            firstPageItems.length
          } annotations`,
        );

        // Check if request is still current
        if (fetchIdRef.current !== currentFetchId) {
          return;
        }

        // If there are more pages and we want to load all, continue in background
        if (more && forceLoadAll) {
          setIsBackgroundLoading(true);
          // Start background loading with a small delay to not block UI
          setTimeout(async () => {
            startTimer('backgroundLoad');
            let backgroundPage = 1;
            let backgroundMore = more;
            const backgroundAll = [...all];

            try {
              while (backgroundMore && fetchIdRef.current === currentFetchId) {
                const { items, hasMore } = await fetchAnnotations({
                  targetCanvasId: canvasId,
                  page: backgroundPage,
                });

                backgroundAll.push(...items);
                backgroundMore = hasMore;
                backgroundPage++;

                // Update cache every few pages or at the end
                if (backgroundPage % 3 === 0 || !backgroundMore) {
                  cacheRef.current.setAnnotations([...backgroundAll]);
                  setLastUpdate(cacheRef.current.getLastUpdate());
                }

                // Check if request is still current
                if (fetchIdRef.current !== currentFetchId) {
                  return;
                }

                // Small delay between background pages to keep UI responsive
                if (backgroundMore) {
                  await new Promise((resolve) => setTimeout(resolve, 50));
                }
              }

              const backgroundLoadTime = endTimer('backgroundLoad');
              console.log(
                `Background loading completed in ${Math.round(
                  backgroundLoadTime,
                )}ms. Total: ${backgroundAll.length} annotations`,
              );

              // Final update with all annotations
              cacheRef.current.setAnnotations(backgroundAll);
              setLastUpdate(cacheRef.current.getLastUpdate());
              setIsBackgroundLoading(false);
              setTotalAvailable(backgroundAll.length);
              setMetric('annotationLoadTime', firstPageLoadTime);
              setMetric('totalAnnotations', backgroundAll.length);

              // Only log if the total process was genuinely slow
              if (firstPageLoadTime + backgroundLoadTime > 5000) {
                logMetrics();
              }
            } catch (err) {
              console.warn('Error in background annotation loading:', err);
              endTimer('backgroundLoad');
              setIsBackgroundLoading(false);
            }
          }, 100); // Small delay before starting background load
        } else {
          // No more pages, we're done
          setMetric('annotationLoadTime', firstPageLoadTime);
          setMetric('totalAnnotations', all.length);
          setTotalAvailable(all.length);
        }
      } catch (err) {
        console.warn('Error fetching annotations:', err);
        if (fetchIdRef.current === currentFetchId) {
          setIsLoading(false);
          setIsBackgroundLoading(false);
        }
        endTimer('annotationLoad');
      }
    },
    [canvasId, maxInitialLoad, startTimer, endTimer, setMetric, logMetrics],
  );

  // Optimized linking annotations fetching with pagination and caching
  useEffect(() => {
    if (!annotations.length) {
      cacheRef.current.setLinkingAnnotations([]);
      setIsLinkingLoading(false);
      return;
    }

    let cancelled = false;
    setIsLinkingLoading(true);

    const fetchLinkingAnnotations = async () => {
      startTimer('linkingLoad');
      try {
        // Fetch all annotations for the canvas and filter for linking locally
        // This is more efficient than fetching by 1000+ annotation IDs
        const { items } = await fetchAnnotations({
          targetCanvasId: canvasId,
          page: 0,
        });

        if (!cancelled) {
          const linking = items.filter((a) => a.motivation === 'linking');
          const loadTime = endTimer('linkingLoad');
          cacheRef.current.setLinkingAnnotations(linking);
          setLastUpdate(cacheRef.current.getLastUpdate());
          setMetric('linkingLoadTime', loadTime);
          setMetric('linkingAnnotations', linking.length);

          // Only log metrics if loading is slow
          if (loadTime > 1000) {
            logMetrics();
          }
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

    // Debounce the fetch to avoid rapid successive calls
    const timeoutId = setTimeout(fetchLinkingAnnotations, 100);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [
    canvasId, // Only depend on canvasId, not annotations.length
    startTimer,
    endTimer,
    setMetric,
    logMetrics,
  ]);

  const getEtag = useCallback((id: string) => cacheRef.current.getEtag(id), []);

  const refresh = useCallback(
    (forceLoadAll = false) => {
      console.log('useAllAnnotations: refresh called', {
        canvasId,
        forceLoadAll,
      });
      if (!canvasId) {
        console.log(
          'useAllAnnotations: canvasId is empty, clearing annotations',
        );
        cacheRef.current.setAnnotations([]);
        cacheRef.current.setLinkingAnnotations([]);
        setLastUpdate(cacheRef.current.getLastUpdate());
        setIsLoading(false);
        setTotalAvailable(0);
        return;
      }
      console.log('useAllAnnotations: starting fetch for canvasId:', canvasId);
      setIsLoading(true);
      setIsBackgroundLoading(false);
      fetchIdRef.current += 1;
      const currentFetchId = fetchIdRef.current;
      fetchAll(currentFetchId, forceLoadAll);
    },
    [canvasId, fetchAll],
  );

  const loadAllAnnotations = useCallback(() => {
    refresh(true);
  }, [refresh]);

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
    isBackgroundLoading,
    totalAvailable,
    hasMore: annotations.length < totalAvailable,
    refresh,
    loadAllAnnotations,
    addAnnotation,
    removeAnnotation,
    getEtag,
  };
}
