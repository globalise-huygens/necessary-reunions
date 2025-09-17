import { LinkingAnnotation } from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';

const bulkLinkingCache = new Map<
  string,
  {
    data: LinkingAnnotation[];
    iconStates: Record<
      string,
      { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
    >;
    timestamp: number;
  }
>();
const CACHE_DURATION = 60000; // Increased to 60 seconds for bulk data
const pendingRequests = new Map<string, Promise<any>>();

export const invalidateBulkLinkingCache = (targetCanvasId?: string) => {
  if (targetCanvasId) {
    // Clear specific canvas cache
    const cacheKey = `bulk-${targetCanvasId}`;
    bulkLinkingCache.delete(cacheKey);
  } else {
    // Clear all cache entries
    bulkLinkingCache.clear();
  }
};

export function useBulkLinkingAnnotations(targetCanvasId: string) {
  const [linkingAnnotations, setLinkingAnnotations] = useState<
    LinkingAnnotation[]
  >([]);
  const [iconStates, setIconStates] = useState<
    Record<string, { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const isMountedRef = useRef(true);

  // Create a stable cache key to ensure all instances share the same data
  const cacheKey = `bulk-${targetCanvasId || 'no-canvas'}`;

  // Force re-render when targetCanvasId changes
  const [lastCanvasId, setLastCanvasId] = useState(targetCanvasId);
  if (lastCanvasId !== targetCanvasId) {
    setLastCanvasId(targetCanvasId);
  }

  // Force fetch if we have a canvas ID but no data and not loading
  useEffect(() => {
    if (targetCanvasId && linkingAnnotations.length === 0 && !isLoading) {
      // Clear any existing cache to force fresh fetch
      bulkLinkingCache.clear();
      setRefreshTrigger((prev) => prev + 1);
    }
  }, [targetCanvasId, linkingAnnotations.length, isLoading]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchBulkLinkingAnnotations = async () => {
      if (!targetCanvasId) {
        // Check if we have data in cache
        const cached = bulkLinkingCache.get(cacheKey);
        const now = Date.now();

        if (cached && now - cached.timestamp < CACHE_DURATION) {
          if (isMountedRef.current) {
            setLinkingAnnotations(cached.data);
            setIconStates(cached.iconStates);
            setIsLoading(false);
          }
          return;
        }

        if (isMountedRef.current) {
          setLinkingAnnotations([]);
          setIconStates({});
          setIsLoading(false);
        }
        return;
      }

      const cached = bulkLinkingCache.get(cacheKey);
      const now = Date.now();

      if (isMountedRef.current) {
        setLinkingAnnotations([]);
        setIconStates({});
        setIsLoading(true);
      }

      if (cached && now - cached.timestamp < CACHE_DURATION) {
        if (isMountedRef.current) {
          setLinkingAnnotations(cached.data);
          setIconStates(cached.iconStates);
          setIsLoading(false);
        }
        return;
      }

      // Use canvas-specific request key to ensure only one request per canvas
      const requestKey = `bulk-fetch-${targetCanvasId}`;
      if (pendingRequests.has(requestKey)) {
        try {
          await pendingRequests.get(requestKey);
          // After the pending request completes, check cache again
          const nowAfterWait = Date.now();
          const cachedAfterWait = bulkLinkingCache.get(cacheKey);
          if (
            cachedAfterWait &&
            nowAfterWait - cachedAfterWait.timestamp < CACHE_DURATION
          ) {
            if (isMountedRef.current) {
              setLinkingAnnotations(cachedAfterWait.data);
              setIconStates(cachedAfterWait.iconStates);
              setIsLoading(false);
            }
          }
          return;
        } catch (error) {
          // Continue with fresh fetch if pending request failed
        }
      }

      if (isMountedRef.current) {
        setIsLoading(true);
      }

      const fetchPromise = (async () => {
        try {
          // Fetch canvas-specific linking annotations
          const url = `/api/annotations/linking-bulk?targetCanvasId=${encodeURIComponent(
            targetCanvasId,
          )}`;
          const response = await fetch(url);

          if (response.ok) {
            const data = await response.json();
            const annotations = data.annotations || [];
            const states = data.iconStates || {};

            // Cache with canvas-specific key
            bulkLinkingCache.set(cacheKey, {
              data: annotations,
              iconStates: states,
              timestamp: now,
            });

            if (isMountedRef.current) {
              setLinkingAnnotations(annotations);
              setIconStates(states);
            }
          } else {
            if (isMountedRef.current) {
              setLinkingAnnotations([]);
              setIconStates({});
            }
          }
        } catch (error) {
          if (isMountedRef.current) {
            setLinkingAnnotations([]);
            setIconStates({});
          }
        } finally {
          if (isMountedRef.current) {
            setIsLoading(false);
          }
          pendingRequests.delete(requestKey);
        }
      })();

      pendingRequests.set(requestKey, fetchPromise);
      await fetchPromise;
    };

    fetchBulkLinkingAnnotations();
  }, [targetCanvasId, refreshTrigger, cacheKey]);

  const getLinkingAnnotationForTarget = useCallback(
    (targetId: string): LinkingAnnotation | null => {
      return (
        linkingAnnotations.find((la) =>
          Array.isArray(la.target)
            ? la.target.includes(targetId)
            : la.target === targetId,
        ) || null
      );
    },
    [linkingAnnotations],
  );

  const isAnnotationLinked = useCallback(
    (annotationId: string): boolean => {
      return !!getLinkingAnnotationForTarget(annotationId);
    },
    [getLinkingAnnotationForTarget],
  );

  const refetch = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const forceRefresh = useCallback(() => {
    invalidateBulkLinkingCache(targetCanvasId);
    setRefreshTrigger((prev) => prev + 1);
  }, [targetCanvasId]);

  const invalidateCache = useCallback(() => {
    invalidateBulkLinkingCache(targetCanvasId);
  }, [targetCanvasId]);

  return {
    linkingAnnotations: linkingAnnotations,
    iconStates: iconStates,
    isLoading,
    getLinkingAnnotationForTarget,
    isAnnotationLinked,
    refetch,
    forceRefresh: forceRefresh,
    invalidateCache,
  };
}
