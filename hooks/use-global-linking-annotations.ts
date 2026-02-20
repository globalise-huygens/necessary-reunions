/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LinkingAnnotation } from '../lib/types';
import { fetchLinkingAnnotationsDirectly } from '../lib/viewer/annoRepo';
import { annotationHealthChecker } from '../lib/viewer/annotation-health-check';

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

export function useGlobalLinkingAnnotations(options?: {
  enabled?: boolean;
  projectSlug?: string;
}) {
  const { enabled = true, projectSlug = 'neru' } = options || {};
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
      // Primary: Direct browser→AnnoRepo (no Netlify timeout)
      const directData = await fetchLinkingAnnotationsDirectly({
        page: currentBatchRef.current,
        projectSlug,
      });

      if (!isMountedRef.current) return;

      if (directData.annotations.length > 0) {
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

      // Fallback: Try API route if direct returned empty
      const url = `/api/annotations/linking-bulk?page=${currentBatchRef.current}&project=${encodeURIComponent(projectSlug)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(url, {
        signal: controller.signal,
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
    } catch {
      // Silently fail - progressive loading is optional
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
    }, 200);

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
    // Don't fetch if disabled - wait for base annotations to load first
    if (!enabled) {
      return;
    }
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
    }

    const fetchPromise = (async () => {
      try {
        // Primary: Direct browser→AnnoRepo (no Netlify timeout)
        const directData = await fetchLinkingAnnotationsDirectly({
          page: 0,
          projectSlug,
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
          setIsGlobalLoading(false);
          return;
        }

        // Fallback: Try API route if direct returned empty
        const url = `/api/annotations/linking-bulk?page=0&project=${encodeURIComponent(projectSlug)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const response = await fetch(url, {
          signal: controller.signal,
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
      } catch {
        // Silently handle - AbortError and network issues are expected
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
  }, [enabled]);

  // Trigger fetch when enabled changes to true or when refreshTrigger changes
  useEffect(() => {
    if (enabled) {
      fetchGlobalLinkingAnnotations().catch(() => {});
    }
  }, [fetchGlobalLinkingAnnotations, refreshTrigger, enabled]);

  const getAnnotationsForCanvas = useCallback(
    (canvasId: string, canvasAnnotationIds?: string[]): LinkingAnnotation[] => {
      if (!canvasId) return [];

      const filtered = allLinkingAnnotations.filter((annotation) => {
        const bodies = Array.isArray(annotation.body) ? annotation.body : [];

        // Check 1: Linking annotations with "selecting" purpose body matching canvas source
        const hasSelectingBody = bodies.some((body) => {
          if (
            body.purpose === 'selecting' &&
            body.source &&
            typeof body.source === 'string'
          ) {
            return body.source === canvasId;
          }
          return false;
        });

        if (hasSelectingBody) return true;

        // Check 2: Linking annotations where any target matches a canvas annotation
        // This handles geotag-only annotations without PointSelector
        if (canvasAnnotationIds && canvasAnnotationIds.length > 0) {
          const targets = Array.isArray(annotation.target)
            ? annotation.target
            : [annotation.target];

          const hasMatchingTarget = targets.some((target) => {
            if (typeof target !== 'string') return false;
            // Check for exact match or suffix match (annotation IDs may be full URLs)
            return canvasAnnotationIds.some(
              (canvasAnnId) =>
                target === canvasAnnId ||
                target.endsWith(`/${canvasAnnId.split('/').pop()}`),
            );
          });

          if (hasMatchingTarget) return true;
        }

        return false;
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

  // Development validation: Check data integrity after loading
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && !isGlobalLoading && enabled) {
      const timer = setTimeout(() => {
        if (allLinkingAnnotations.length === 0) {
          console.warn('[Linking Annotations] No linking annotations loaded', {
            enabled,
            cacheKeys: Array.from(globalLinkingCache.keys()),
          });
        } else {
          annotationHealthChecker.recordLinkingAnnotationsLoaded(
            allLinkingAnnotations.length,
            enabled,
          );
          console.info('[Linking Annotations] Loaded successfully:', {
            count: allLinkingAnnotations.length,
            hasIconStates: Object.keys(globalIconStates).length > 0,
            hasMore,
          });
        }
      }, 2000); // Wait 2s after loading completes
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGlobalLoading, allLinkingAnnotations.length, enabled, hasMore]);

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
