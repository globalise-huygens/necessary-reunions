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
      const url = `/api/annotations/linking-bulk?page=${currentBatchRef.current}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

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

        // Update global cache
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
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn('Failed to load more annotations:', error);
      }
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
    // Progressive auto-loading of all pages
    if (
      !hasMore ||
      isGlobalLoading ||
      isLoadingMore ||
      allLinkingAnnotations.length === 0
    ) {
      return;
    }

    // Auto-load next page with small delay
    const timer = setTimeout(() => {
      loadMoreAnnotations().catch(() => {
        // Ignore errors
      });
    }, 50); // Fast progressive loading

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
          currentBatchRef.current =
            cached.loadingProgress.processed > 0 ? 1 : 0;
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
          // Fetch first page using new paginated endpoint
          const url = `/api/annotations/linking-bulk?page=0`;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const response = await fetch(url, {
            signal: controller.signal,
            cache: 'no-cache',
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            const annotations = data.annotations || [];
            const states = data.iconStates || {};

            if (!isMountedRef.current) return;

            setHasMore(data.hasMore || false);
            setTotalAnnotations(annotations.length);
            setLoadingProgress({
              processed: data.count || 0,
              total: annotations.length,
              mode: 'quick',
            });

            currentBatchRef.current = 1;

            // Cache globally
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
          } else {
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
