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
    console.log('Invalidated cache for canvas:', targetCanvasId);
  } else {
    // Clear all cache entries
    bulkLinkingCache.clear();
    console.log('Invalidated all bulk linking cache');
  }
};

export function useBulkLinkingAnnotations(targetCanvasId: string) {
  const hookId = useRef(Math.random().toString(36).substr(2, 9));

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
    console.log(
      `useBulkLinkingAnnotations[${hookId.current}]: Canvas ID changed from '${lastCanvasId}' to '${targetCanvasId}'`,
    );
    setLastCanvasId(targetCanvasId);
  }

  console.log(
    `useBulkLinkingAnnotations[${hookId.current}]: Hook called with targetCanvasId:`,
    targetCanvasId,
    'current state length:',
    linkingAnnotations.length,
  );

  // Force fetch if we have a canvas ID but no data and not loading
  useEffect(() => {
    if (targetCanvasId && linkingAnnotations.length === 0 && !isLoading) {
      console.log(
        `useBulkLinkingAnnotations[${hookId.current}]: Detected missing data for canvas, forcing refresh`,
        targetCanvasId,
      );
      // Clear any existing cache to force fresh fetch
      bulkLinkingCache.clear();
      setRefreshTrigger((prev) => prev + 1);
    }
  }, [targetCanvasId, linkingAnnotations.length, isLoading]);

  useEffect(() => {
    console.log(
      `useBulkLinkingAnnotations[${hookId.current}]: Component mounted`,
    );
    isMountedRef.current = true;
    return () => {
      console.log(
        `useBulkLinkingAnnotations[${hookId.current}]: Component unmounting, setting isMountedRef to false`,
      );
      isMountedRef.current = false;
    };
  }, []);

  // Debug: Log when linkingAnnotations state changes
  useEffect(() => {
    console.log(
      'useBulkLinkingAnnotations: State changed - linkingAnnotations.length:',
      linkingAnnotations.length,
      'for canvasId:',
      targetCanvasId,
    );
  }, [linkingAnnotations, targetCanvasId]);

  useEffect(() => {
    console.log(
      `useBulkLinkingAnnotations[${hookId.current}]: useEffect triggered`,
      { targetCanvasId, refreshTrigger, cacheKey },
    );

    const fetchBulkLinkingAnnotations = async () => {
      console.log(
        'useBulkLinkingAnnotations: Starting fetch for canvas:',
        targetCanvasId,
      );

      if (!targetCanvasId) {
        console.log(
          'useBulkLinkingAnnotations: No targetCanvasId, but checking cache for any linking annotations',
        );

        // Check if we have data in cache
        const cached = bulkLinkingCache.get(cacheKey);
        const now = Date.now();

        if (cached && now - cached.timestamp < CACHE_DURATION) {
          console.log(
            'useBulkLinkingAnnotations: Found cached data, using it even without canvasId',
          );
          if (isMountedRef.current) {
            setLinkingAnnotations(cached.data);
            setIconStates(cached.iconStates);
            setIsLoading(false);
          }
          return;
        }

        // Clear data if no cache and no canvasId
        if (isMountedRef.current) {
          setLinkingAnnotations([]);
          setIconStates({});
          setIsLoading(false);
        }
        return;
      }

      // Check cache first
      const cached = bulkLinkingCache.get(cacheKey);
      const now = Date.now();

      console.log('useBulkLinkingAnnotations: Cache lookup:', {
        targetCanvasId,
        cacheKey,
        cacheHasData: !!cached,
        cacheDataLength: cached?.data?.length || 0,
        cacheAge: cached ? now - cached.timestamp : 'N/A',
        cacheValid: cached && now - cached.timestamp < CACHE_DURATION,
      });

      // Clear previous data immediately when canvas changes (before checking cache)
      if (isMountedRef.current) {
        setLinkingAnnotations([]);
        setIconStates({});
        setIsLoading(true);
      }

      if (cached && now - cached.timestamp < CACHE_DURATION) {
        console.log(
          'useBulkLinkingAnnotations: Using cached data',
          cached.data.length,
          'annotations',
        );
        if (isMountedRef.current) {
          console.log(
            'useBulkLinkingAnnotations: Setting state with cached data',
          );
          setLinkingAnnotations(cached.data);
          setIconStates(cached.iconStates);
          setIsLoading(false);
        }
        return;
      }

      // Use canvas-specific request key to ensure only one request per canvas
      const requestKey = `bulk-fetch-${targetCanvasId}`;
      if (pendingRequests.has(requestKey)) {
        console.log(
          'useBulkLinkingAnnotations: Request already pending, waiting...',
        );
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
          console.error(
            'useBulkLinkingAnnotations: Pending request failed:',
            error,
          );
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
          console.log(
            'useBulkLinkingAnnotations: Fetching canvas-specific linking annotations from URL:',
            url,
          );
          const response = await fetch(url);

          if (response.ok) {
            const data = await response.json();
            const annotations = data.annotations || [];
            const states = data.iconStates || {};

            console.log('useBulkLinkingAnnotations: Fetch successful', {
              annotationsCount: annotations.length,
              iconStatesCount: Object.keys(states).length,
              url,
              isMountedRefCurrent: isMountedRef.current,
            });

            // Cache with canvas-specific key
            bulkLinkingCache.set(cacheKey, {
              data: annotations,
              iconStates: states,
              timestamp: now,
            });

            if (isMountedRef.current) {
              console.log(
                'useBulkLinkingAnnotations: About to set state with',
                annotations.length,
                'annotations',
              );
              setLinkingAnnotations(annotations);
              setIconStates(states);
              console.log('useBulkLinkingAnnotations: State setting completed');
            } else {
              console.log(
                'useBulkLinkingAnnotations: Component unmounted, skipping state update',
              );
            }
          } else {
            console.error(
              'useBulkLinkingAnnotations: Fetch failed with status:',
              response.status,
            );
            if (isMountedRef.current) {
              setLinkingAnnotations([]);
              setIconStates({});
            }
          }
        } catch (error) {
          console.error('useBulkLinkingAnnotations: Fetch error:', error);
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

  // Debug: Log what we're returning to the component
  console.log('useBulkLinkingAnnotations: Returning to component:', {
    linkingAnnotations_length: linkingAnnotations.length,
    iconStates_length: Object.keys(iconStates).length,
    targetCanvasId: targetCanvasId,
    linkingAnnotations_ref: linkingAnnotations,
  });

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
