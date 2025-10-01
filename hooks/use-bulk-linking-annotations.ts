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
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [isPermanentFailure, setIsPermanentFailure] = useState(false);
  const isMountedRef = useRef(true);
  const MAX_RETRIES = 2; // Reduced from 3 to 2 for faster failure detection
  const RETRY_DELAY_BASE = 2000; // Increased to 2 seconds base delay
  const PERMANENT_FAILURE_CODES = [404, 502, 503, 504]; // Consider these as permanent failures in deployment

  // Create a stable cache key to ensure all instances share the same data
  const cacheKey = `bulk-${targetCanvasId || 'no-canvas'}`;

  // Force re-render when targetCanvasId changes
  const [lastCanvasId, setLastCanvasId] = useState(targetCanvasId);
  if (lastCanvasId !== targetCanvasId) {
    setLastCanvasId(targetCanvasId);
  }

  // Reset error and retry count when targetCanvasId changes
  useEffect(() => {
    if (targetCanvasId !== lastCanvasId) {
      setError(null);
      setRetryCount(0);
      setIsPermanentFailure(false);
    }
  }, [targetCanvasId, lastCanvasId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchBulkLinkingAnnotations = async () => {
      // Don't fetch if we have a permanent failure
      if (isPermanentFailure) {
        if (isMountedRef.current) {
          setLinkingAnnotations([]);
          setIconStates({});
          setIsLoading(false);
        }
        return;
      }

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

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000); // Reduced to 20 seconds for deployments

          const response = await fetch(url, {
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

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
              setError(null);
              setRetryCount(0);
              setIsPermanentFailure(false);
            }
          } else {
            const errorMsg = `API error: ${response.status} ${response.statusText}`;
            console.warn('Bulk linking API error:', errorMsg);

            if (isMountedRef.current) {
              setError(errorMsg);
              setLinkingAnnotations([]);
              setIconStates({});
            }

            // Check for permanent failures (deployment issues)
            if (PERMANENT_FAILURE_CODES.includes(response.status)) {
              if (retryCount >= MAX_RETRIES) {
                console.warn(
                  'Marking bulk linking as permanently failed after retries',
                );
                if (isMountedRef.current) {
                  setIsPermanentFailure(true);
                }
                return;
              }
            }

            // Only retry on certain status codes and if under retry limit
            if (
              (response.status >= 500 || response.status === 429) &&
              retryCount < MAX_RETRIES &&
              !isPermanentFailure
            ) {
              const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
              setTimeout(() => {
                if (isMountedRef.current && !isPermanentFailure) {
                  setRetryCount((prev) => prev + 1);
                  setRefreshTrigger((prev) => prev + 1);
                }
              }, delay);
            } else if (retryCount >= MAX_RETRIES) {
              // Mark as permanent failure after max retries
              if (isMountedRef.current) {
                setIsPermanentFailure(true);
              }
            }
          }
        } catch (error: any) {
          const errorMsg =
            error.name === 'AbortError'
              ? 'Request timeout'
              : error.message || 'Network error';
          console.warn('Bulk linking fetch error:', errorMsg);

          if (isMountedRef.current) {
            setError(errorMsg);
            setLinkingAnnotations([]);
            setIconStates({});

            // Only retry network errors if under retry limit and not a timeout
            if (
              retryCount < MAX_RETRIES &&
              error.name !== 'AbortError' &&
              !isPermanentFailure
            ) {
              const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
              setTimeout(() => {
                if (isMountedRef.current && !isPermanentFailure) {
                  setRetryCount((prev) => prev + 1);
                  setRefreshTrigger((prev) => prev + 1);
                }
              }, delay);
            } else {
              // Mark as permanent failure after timeout or max retries
              if (isMountedRef.current) {
                setIsPermanentFailure(true);
              }
            }
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
    setIsPermanentFailure(false);
    setRetryCount(0);
    setError(null);
    setRefreshTrigger((prev) => prev + 1);
  }, [targetCanvasId]);

  const invalidateCache = useCallback(() => {
    invalidateBulkLinkingCache(targetCanvasId);
  }, [targetCanvasId]);

  return {
    linkingAnnotations: linkingAnnotations,
    iconStates: iconStates,
    isLoading,
    error,
    retryCount,
    isPermanentFailure,
    getLinkingAnnotationForTarget,
    isAnnotationLinked,
    refetch,
    forceRefresh: forceRefresh,
    invalidateCache,
  };
}
