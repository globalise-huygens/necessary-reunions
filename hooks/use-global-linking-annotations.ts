/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LinkingAnnotation } from '../lib/types';
import { fetchLinkingAnnotationsDirectly } from '../lib/viewer/annoRepo';

const globalLinkingCache = new Map<
  string,
  {
    data: LinkingAnnotation[];
    iconStates: Record<
      string,
      { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
    >;
    hasMore: boolean;
    totalAnnotations: number;
    loadingProgress: {
      processed: number;
      total: number;
      mode: 'quick' | 'full';
    };
    timestamp: number;
  }
>();

const CACHE_DURATION = 5 * 60 * 1000;
const pendingGlobalRequest = { current: null as Promise<any> | null };
const GLOBAL_CACHE_KEY = 'global-linking-annotations';

export function useGlobalLinkingAnnotations() {
  const [allLinkingAnnotations, setAllLinkingAnnotations] = useState<
    LinkingAnnotation[]
  >([]);

  const [globalIconStates, setGlobalIconStates] = useState<
    Record<string, { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }>
  >({});
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalAnnotations, setTotalAnnotations] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState<{
    processed: number;
    total: number;
    mode: 'quick' | 'full';
  }>({ processed: 0, total: 0, mode: 'quick' });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const isMountedRef = useRef(true);
  const currentBatchRef = useRef<number>(0);

  const loadMoreAnnotations = useCallback(async () => {
    if (!hasMore || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const url = `/api/annotations/linking-bulk?page=${currentBatchRef.current}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const newAnnotations = (data.annotations || []) as LinkingAnnotation[];
        const newStates = data.iconStates || {};

        // Log server response details
        if (data.error) {
          console.warn(
            `[Global Linking] Server returned error for page ${currentBatchRef.current}:`,
            {
              error: data.error,
              annotationCount: newAnnotations.length,
              hasIconStates: Object.keys(newStates).length > 0,
            },
          );
        }

        // Check if server returned empty result - fallback to direct regardless of error field
        if (newAnnotations.length === 0) {
          try {
            const directData = await fetchLinkingAnnotationsDirectly({
              page: currentBatchRef.current,
            });
            if (!isMountedRef.current) return;

            if (directData.annotations.length > 0) {
              console.log(
                `[Global Linking] Direct fallback succeeded for page ${currentBatchRef.current}:`,
                {
                  count: directData.annotations.length,
                  hasMore: directData.hasMore,
                },
              );

              setAllLinkingAnnotations((prev) => {
                const existingIds = new Set(
                  prev.map((a: any) => a.id || JSON.stringify(a)),
                );
                const uniqueNew = directData.annotations.filter(
                  (a: any) => !existingIds.has(a.id || JSON.stringify(a)),
                );
                return [...prev, ...uniqueNew];
              });

              setGlobalIconStates((prev) => ({
                ...prev,
                ...directData.iconStates,
              }));
              setHasMore(directData.hasMore);

              const newProcessed = loadingProgress.processed + directData.count;
              setLoadingProgress({
                processed: newProcessed,
                total: loadingProgress.total || newProcessed,
                mode: 'full',
              });

              currentBatchRef.current = currentBatchRef.current + 1;

              const cached = globalLinkingCache.get(GLOBAL_CACHE_KEY);
              if (cached) {
                const existingIds = new Set(
                  cached.data.map((a: any) => a.id || JSON.stringify(a)),
                );
                const uniqueNew = directData.annotations.filter(
                  (a: any) => !existingIds.has(a.id || JSON.stringify(a)),
                );
                const allAnnotations = [...cached.data, ...uniqueNew];
                globalLinkingCache.set(GLOBAL_CACHE_KEY, {
                  ...cached,
                  data: allAnnotations,
                  iconStates: {
                    ...cached.iconStates,
                    ...directData.iconStates,
                  },
                  hasMore: directData.hasMore,
                  totalAnnotations: allAnnotations.length,
                  loadingProgress: {
                    processed: newProcessed,
                    total: allAnnotations.length,
                    mode: 'full',
                  },
                });
              }
              return;
            }
          } catch (directError) {
            console.error(
              '[Global Linking] Direct load more failed:',
              directError,
            );
          }
        }

        if (!isMountedRef.current) return;

        setAllLinkingAnnotations((prev) => {
          const existingIds = new Set(
            prev.map((a: any) => a.id || JSON.stringify(a)),
          );
          const uniqueNew = newAnnotations.filter(
            (a: any) => !existingIds.has(a.id || JSON.stringify(a)),
          );
          return [...prev, ...uniqueNew];
        });

        setGlobalIconStates((prev) => ({ ...prev, ...newStates }));
        setHasMore(data.hasMore || false);

        const newProcessed = loadingProgress.processed + data.count;
        setLoadingProgress({
          processed: newProcessed,
          total: loadingProgress.total || newProcessed,
          mode: 'full',
        });

        currentBatchRef.current = currentBatchRef.current + 1;

        const cached = globalLinkingCache.get(GLOBAL_CACHE_KEY);
        if (cached) {
          const existingIds = new Set(
            cached.data.map((a: any) => a.id || JSON.stringify(a)),
          );
          const uniqueNew = newAnnotations.filter(
            (a: any) => !existingIds.has(a.id || JSON.stringify(a)),
          );
          const allAnnotations = [...cached.data, ...uniqueNew];
          globalLinkingCache.set(GLOBAL_CACHE_KEY, {
            ...cached,
            data: allAnnotations,
            iconStates: { ...cached.iconStates, ...newStates },
            hasMore: data.hasMore || false,
            totalAnnotations: allAnnotations.length,
            loadingProgress: {
              processed: newProcessed,
              total: allAnnotations.length,
              mode: 'full',
            },
          });
        }
      }
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      console.warn('[Global Linking] Failed to load more annotations:', {
        page: currentBatchRef.current,
        isTimeout,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [
    hasMore,
    isLoadingMore,
    loadingProgress.processed,
    loadingProgress.total,
  ]);

  useEffect(() => {
    if (
      !hasMore ||
      isGlobalLoading ||
      isLoadingMore ||
      allLinkingAnnotations.length === 0
    ) {
      return;
    }

    const timer = setTimeout(() => {
      loadMoreAnnotations().catch(() => {});
    }, 50);

    return () => clearTimeout(timer);
  }, [
    hasMore,
    isGlobalLoading,
    isLoadingMore,
    allLinkingAnnotations.length,
    loadMoreAnnotations,
  ]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchGlobalLinkingAnnotations = useCallback(async () => {
    const cached = globalLinkingCache.get(GLOBAL_CACHE_KEY);
    const currentTime = Date.now();

    if (cached && currentTime - cached.timestamp < CACHE_DURATION) {
      if (isMountedRef.current) {
        setAllLinkingAnnotations(cached.data);
        setGlobalIconStates(cached.iconStates);
        setIsGlobalLoading(false);
        setHasMore(cached.hasMore);
        setTotalAnnotations(cached.totalAnnotations);
        setLoadingProgress(cached.loadingProgress);
        currentBatchRef.current = cached.loadingProgress.processed > 0 ? 1 : 0;
      }
      return;
    }

    if (pendingGlobalRequest.current) {
      try {
        await pendingGlobalRequest.current;
        const freshCache = globalLinkingCache.get(GLOBAL_CACHE_KEY);
        if (freshCache && isMountedRef.current) {
          setAllLinkingAnnotations(freshCache.data);
          setGlobalIconStates(freshCache.iconStates);
          setIsGlobalLoading(false);
          setHasMore(freshCache.hasMore);
          setTotalAnnotations(freshCache.totalAnnotations);
          setLoadingProgress(freshCache.loadingProgress);
          currentBatchRef.current =
            freshCache.loadingProgress.processed > 0 ? 1 : 0;
        }
      } catch {}
      return;
    }

    if (isMountedRef.current) {
      setAllLinkingAnnotations([]);
      setGlobalIconStates({});
      setIsGlobalLoading(true);
      console.log('[Global Linking] Set isGlobalLoading = true');
    }

    console.log('[Global Linking] Starting to fetch linking annotations...');

    const fetchPromise = (async () => {
      try {
        const url = `/api/annotations/linking-bulk?page=0`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const response = await fetch(url, {
          signal: controller.signal,
          cache: 'no-cache',
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const annotations = data.annotations || [];
          const states = data.iconStates || {};

          console.log(`[Global Linking] Initial fetch completed:`, {
            annotationCount: annotations.length,
            iconStatesCount: Object.keys(states).length,
            hasMore: data.hasMore,
            hasError: !!data.error,
            error: data.error,
          });

          // Check if server returned empty result - fallback to direct regardless of error field
          if (annotations.length === 0) {
            try {
              const directData = await fetchLinkingAnnotationsDirectly({
                page: 0,
              });
              if (!isMountedRef.current) return;

              if (directData.annotations.length > 0) {
                console.log(
                  `[Global Linking] Initial direct fallback succeeded:`,
                  {
                    count: directData.annotations.length,
                    hasMore: directData.hasMore,
                    mode: 'replacing empty server response',
                  },
                );

                setHasMore(directData.hasMore);
                setTotalAnnotations(directData.annotations.length);
                setLoadingProgress({
                  processed: directData.count,
                  total: directData.annotations.length,
                  mode: 'quick',
                });

                currentBatchRef.current = 1;

                globalLinkingCache.set(GLOBAL_CACHE_KEY, {
                  data: directData.annotations,
                  iconStates: directData.iconStates,
                  hasMore: directData.hasMore,
                  totalAnnotations: directData.annotations.length,
                  loadingProgress: {
                    processed: directData.count,
                    total: directData.annotations.length,
                    mode: 'quick',
                  },
                  timestamp: currentTime,
                });

                setAllLinkingAnnotations(directData.annotations);
                setGlobalIconStates(directData.iconStates);
                console.log(
                  '[Global Linking] ✓ Direct fallback succeeded, setting isGlobalLoading = false',
                );
                setIsGlobalLoading(false);
                return;
              }
            } catch (directError) {
              console.error(
                '[Global Linking] Direct access also failed:',
                directError,
              );
            }
          }

          if (!isMountedRef.current) return;

          setHasMore(data.hasMore || false);
          setTotalAnnotations(annotations.length);
          setLoadingProgress({
            processed: data.count || 0,
            total: annotations.length,
            mode: 'quick',
          });

          currentBatchRef.current = 1;

          globalLinkingCache.set(GLOBAL_CACHE_KEY, {
            data: annotations,
            iconStates: states,
            hasMore: data.hasMore || false,
            totalAnnotations: annotations.length,
            loadingProgress: {
              processed: data.count || 0,
              total: annotations.length,
              mode: 'quick',
            },
            timestamp: currentTime,
          });

          setAllLinkingAnnotations(annotations);
          setGlobalIconStates(states);
          console.log(
            '[Global Linking] ✓ Linking annotations loaded successfully:',
            {
              count: annotations.length,
              hasMore: data.hasMore,
            },
          );
        } else {
          // HTTP error - try direct access
          console.warn(
            '[Global Linking] Server request failed, trying direct access',
            { status: response.status },
          );
          try {
            const directData = await fetchLinkingAnnotationsDirectly({
              page: 0,
            });
            if (!isMountedRef.current) return;

            if (directData.annotations.length > 0) {
              setHasMore(directData.hasMore);
              setTotalAnnotations(directData.annotations.length);
              setLoadingProgress({
                processed: directData.count,
                total: directData.annotations.length,
                mode: 'quick',
              });

              currentBatchRef.current = 1;

              globalLinkingCache.set(GLOBAL_CACHE_KEY, {
                data: directData.annotations,
                iconStates: directData.iconStates,
                hasMore: directData.hasMore,
                totalAnnotations: directData.annotations.length,
                loadingProgress: {
                  processed: directData.count,
                  total: directData.annotations.length,
                  mode: 'quick',
                },
                timestamp: currentTime,
              });

              setAllLinkingAnnotations(directData.annotations);
              setGlobalIconStates(directData.iconStates);
              console.log(
                '[Global Linking] ✓ Direct fallback (HTTP error) succeeded, setting isGlobalLoading = false',
              );
              setIsGlobalLoading(false);
              return;
            }
          } catch (directError) {
            console.error(
              '[Global Linking] Direct access also failed:',
              directError,
            );
          }

          if (isMountedRef.current) {
            setAllLinkingAnnotations([]);
            setGlobalIconStates({});
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.warn('Failed to fetch global linking annotations:', error);
        }
        if (isMountedRef.current) {
          setAllLinkingAnnotations([]);
          setGlobalIconStates({});
        }
      } finally {
        if (isMountedRef.current) {
          console.log('[Global Linking] Finally block: setting isGlobalLoading = false');
          setIsGlobalLoading(false);
        }
        pendingGlobalRequest.current = null;
      }
    })();

    pendingGlobalRequest.current = fetchPromise;
    await fetchPromise;
  }, []);

  // Trigger fetch on mount AND when refreshTrigger changes
  useEffect(() => {
    fetchGlobalLinkingAnnotations().catch(() => {});
  }, [refreshTrigger, fetchGlobalLinkingAnnotations]);

  const getAnnotationsForCanvas = useCallback(
    (canvasId: string): LinkingAnnotation[] => {
      if (!canvasId) return [];

      const filtered = allLinkingAnnotations.filter((annotation) => {
        const bodies = Array.isArray(annotation.body) ? annotation.body : [];

        return bodies.some((body) => {
          // Linking annotations have a "selecting" purpose body with the canvas source
          if (
            body.purpose === 'selecting' &&
            body.source &&
            typeof body.source === 'string'
          ) {
            return body.source === canvasId;
          }
          return false;
        });
      });

      return filtered;
    },
    [allLinkingAnnotations],
  );

  const getIconStatesForCanvas = useCallback(
    (
      canvasId: string,
    ): Record<
      string,
      { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
    > => {
      if (!canvasId) return {};

      const canvasAnnotations = getAnnotationsForCanvas(canvasId);
      const canvasStates: Record<
        string,
        { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
      > = {};

      canvasAnnotations.forEach((annotation) => {
        const targets = Array.isArray(annotation.target)
          ? annotation.target
          : [annotation.target];

        targets.forEach((target) => {
          if (typeof target === 'string' && globalIconStates[target]) {
            canvasStates[target] = globalIconStates[target];
          }
        });
      });

      return canvasStates;
    },
    [globalIconStates, getAnnotationsForCanvas],
  );

  const invalidateGlobalCache = useCallback(() => {
    globalLinkingCache.delete(GLOBAL_CACHE_KEY);
  }, []);

  const refetch = useCallback(() => {
    invalidateGlobalCache();
    setRefreshTrigger((prev) => prev + 1);
  }, [invalidateGlobalCache]);

  return {
    allLinkingAnnotations,
    globalIconStates,
    isGlobalLoading,

    isLoadingMore,
    hasMore,
    totalAnnotations,
    loadingProgress,
    loadMoreAnnotations,

    getAnnotationsForCanvas,
    getIconStatesForCanvas,

    invalidateGlobalCache,
    refetch,
  };
}

export const invalidateGlobalLinkingCache = () => {
  globalLinkingCache.delete(GLOBAL_CACHE_KEY);
};
