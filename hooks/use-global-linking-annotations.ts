/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LinkingAnnotation } from '../lib/types';

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

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
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
      const url = `/api/annotations/linking-bulk?mode=full&batch=${currentBatchRef.current}&global=true`;

      const response = await fetch(url, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const newAnnotations = data.annotations || [];
        const newStates = data.iconStates || {};

        setAllLinkingAnnotations((prev) => {
          const merged = [...prev, ...newAnnotations];
          return merged;
        });
        setGlobalIconStates((prev) => ({ ...prev, ...newStates }));
        setHasMore(data.hasMore || false);

        const newProcessed =
          data.processedAnnotations + loadingProgress.processed;
        setLoadingProgress({
          processed: newProcessed,
          total: data.totalAnnotations,
          mode: 'full',
        });

        currentBatchRef.current = data.nextBatch || currentBatchRef.current + 1;

        // Update global cache
        const cached = globalLinkingCache.get(GLOBAL_CACHE_KEY);
        if (cached) {
          const allAnnotations = [...cached.data, ...newAnnotations];
          globalLinkingCache.set(GLOBAL_CACHE_KEY, {
            ...cached,
            data: allAnnotations,
            iconStates: { ...cached.iconStates, ...newStates },
            hasMore: data.hasMore || false,
            totalAnnotations: data.totalAnnotations,
            loadingProgress: {
              processed: newProcessed,
              total: data.totalAnnotations,
              mode: 'full',
            },
          });
        }
      } else {
        // Error response
      }
    } catch {
      // Ignore network errors
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, loadingProgress.processed]);

  useEffect(() => {
    if (
      !hasMore ||
      isGlobalLoading ||
      isLoadingMore ||
      totalAnnotations === 0
    ) {
      return;
    }

    const shouldTriggerProgressive =
      allLinkingAnnotations.length < totalAnnotations;

    if (shouldTriggerProgressive) {
      const timer = setTimeout(() => {
        loadMoreAnnotations().catch(() => {
          // Ignore errors
        });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [
    hasMore,
    isGlobalLoading,
    isLoadingMore,
    totalAnnotations,
    allLinkingAnnotations.length,
    loadMoreAnnotations,
  ]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchGlobalLinkingAnnotations = async () => {
      // Check cache first
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
          }
        } catch {
          // Ignore errors
        }
        return;
      }

      if (isMountedRef.current) {
        setAllLinkingAnnotations([]);
        setGlobalIconStates({});
        setIsGlobalLoading(true);
      }

      const fetchPromise = (async () => {
        try {
          const url = `/api/annotations/linking-bulk?mode=quick&batch=0&global=true`;

          const response = await fetch(url, {
            cache: 'no-cache',
          });

          if (response.ok) {
            const data = await response.json();
            const annotations = data.annotations || [];
            const states = data.iconStates || {};

            setHasMore(data.hasMore || false);
            setTotalAnnotations(data.totalAnnotations || 0);
            setLoadingProgress({
              processed: data.processedAnnotations || 0,
              total: data.totalAnnotations || 0,
              mode: data.mode || 'quick',
            });

            currentBatchRef.current = data.nextBatch || 1;

            // Cache globally
            globalLinkingCache.set(GLOBAL_CACHE_KEY, {
              data: annotations,
              iconStates: states,
              hasMore: data.hasMore || false,
              totalAnnotations: data.totalAnnotations || 0,
              loadingProgress: {
                processed: data.processedAnnotations || 0,
                total: data.totalAnnotations || 0,
                mode: data.mode || 'quick',
              },
              timestamp: currentTime,
            });

            if (isMountedRef.current) {
              setAllLinkingAnnotations(annotations);
              setGlobalIconStates(states);
            }
          } else {
            if (isMountedRef.current) {
              setAllLinkingAnnotations([]);
              setGlobalIconStates({});
            }
          }
        } catch {
          if (isMountedRef.current) {
            setAllLinkingAnnotations([]);
            setGlobalIconStates({});
          }
        } finally {
          if (isMountedRef.current) {
            setIsGlobalLoading(false);
          }
          pendingGlobalRequest.current = null;
        }
      })();

      pendingGlobalRequest.current = fetchPromise;
      await fetchPromise;
    };

    fetchGlobalLinkingAnnotations().catch(() => {
      // Ignore errors
    });
  }, [refreshTrigger]);

  const getAnnotationsForCanvas = useCallback(
    (canvasId: string): LinkingAnnotation[] => {
      if (!canvasId) return [];

      return allLinkingAnnotations.filter((annotation) => {
        const bodies = Array.isArray(annotation.body) ? annotation.body : [];

        return bodies.some((body) => {
          if (body.source && typeof body.source === 'string') {
            return body.source === canvasId;
          }
          return false;
        });
      });
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
