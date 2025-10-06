import { LinkingAnnotation } from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { blockRequestPermanently, isRequestBlocked } from '@/lib/request-blocker';

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
const pendingRequests = new Map<
  string,
  { promise: Promise<any>; controller: AbortController }
>();
const failedRequests = new Map<
  string,
  { count: number; lastFailed: number; circuitOpen: boolean }
>();
const MAX_RETRY_COUNT = 1; // Reduced to 1 - no retries allowed
const RETRY_BACKOFF_MS = 30000; // Increased to 30s
const CIRCUIT_BREAKER_TIMEOUT = 300000; // 5 minutes for permanent failures
const REQUEST_TIMEOUT = 15000; // Reduced to 15s

export const invalidateBulkLinkingCache = (targetCanvasId?: string) => {
  if (targetCanvasId) {
    // Clear specific canvas cache
    const cacheKey = `bulk-${targetCanvasId}`;
    bulkLinkingCache.delete(cacheKey);
    failedRequests.delete(cacheKey);
  } else {
    // Clear all cache entries
    bulkLinkingCache.clear();
    failedRequests.clear();
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

      // Check if URL is blocked by global request blocker
      const url = `/api/annotations/linking-bulk?targetCanvasId=${encodeURIComponent(
        targetCanvasId,
      )}`;
      
      if (isRequestBlocked(url)) {
        console.warn(`Request blocked by global blocker: ${url}`);
        if (isMountedRef.current) {
          setLinkingAnnotations([]);
          setIconStates({});
          setIsLoading(false);
        }
        return;
      }
      const failureInfo = failedRequests.get(cacheKey);
      const now = Date.now();
      if (failureInfo) {
        // Check if circuit breaker is open
        if (failureInfo.circuitOpen) {
          const timeSinceFailure = now - failureInfo.lastFailed;
          if (timeSinceFailure < CIRCUIT_BREAKER_TIMEOUT) {
            console.warn(
              `Circuit breaker open for ${cacheKey}, blocking requests for ${Math.ceil(
                (CIRCUIT_BREAKER_TIMEOUT - timeSinceFailure) / 1000,
              )}s`,
            );
            if (isMountedRef.current) {
              setLinkingAnnotations([]);
              setIconStates({});
              setIsLoading(false);
            }
            return;
          } else {
            // Reset circuit breaker after timeout
            failedRequests.delete(cacheKey);
          }
        }

        // Check regular retry limit
        if (failureInfo.count >= MAX_RETRY_COUNT) {
          const timeSinceLastFailure = now - failureInfo.lastFailed;
          if (timeSinceLastFailure < RETRY_BACKOFF_MS) {
            console.warn(
              `Too many failures for ${cacheKey}, backing off for ${Math.ceil(
                (RETRY_BACKOFF_MS - timeSinceLastFailure) / 1000,
              )}s`,
            );
            if (isMountedRef.current) {
              setLinkingAnnotations([]);
              setIconStates({});
              setIsLoading(false);
            }
            return;
          } else {
            // Reset failure count after backoff period
            failedRequests.delete(cacheKey);
          }
        }
      }

      const cached = bulkLinkingCache.get(cacheKey);

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
      const pendingRequest = pendingRequests.get(requestKey);
      if (pendingRequest) {
        try {
          await pendingRequest.promise;
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

      // Create abort controller for this request
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, REQUEST_TIMEOUT);

      const fetchPromise = (async () => {
        try {
          // Fetch canvas-specific linking annotations
          const url = `/api/annotations/linking-bulk?targetCanvasId=${encodeURIComponent(
            targetCanvasId,
          )}`;
          
          // Double-check if request was blocked while we were setting up
          if (isRequestBlocked(url)) {
            console.warn('Request blocked during setup');
            return;
          }
          
          const response = await fetch(url, {
            signal: abortController.signal,
            cache: 'no-cache',
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

            // Clear failure count on success
            failedRequests.delete(cacheKey);

            if (isMountedRef.current) {
              setLinkingAnnotations(annotations);
              setIconStates(states);
            }
          } else {
            console.warn(
              `Bulk linking API failed with status: ${response.status}`,
            );

            const current = failedRequests.get(cacheKey) || {
              count: 0,
              lastFailed: 0,
              circuitOpen: false,
            };

            // For 502/504 errors, permanently disable requests
            if (response.status === 502 || response.status === 504) {
              blockRequestPermanently(url); // Block at global level too
              failedRequests.set(cacheKey, {
                count: 999, // Effectively permanent
                lastFailed: Date.now(),
                circuitOpen: true, // Permanently open circuit breaker
              });
              console.log(
                `Gateway timeout ${response.status}, circuit breaker permanently opened`,
              );
            } else {
              // Track other failures normally
              const newCount = current.count + 1;
              failedRequests.set(cacheKey, {
                count: newCount,
                lastFailed: Date.now(),
                circuitOpen: newCount >= MAX_RETRY_COUNT, // Open circuit if max retries reached
              });
            }

            if (isMountedRef.current) {
              setLinkingAnnotations([]);
              setIconStates({});
            }
          }
        } catch (error: any) {
          clearTimeout(timeoutId);
          console.warn(`Bulk linking API error:`, error);

          const current = failedRequests.get(cacheKey) || {
            count: 0,
            lastFailed: 0,
            circuitOpen: false,
          };

          // Check if it's an abort/timeout error
          const isTimeoutError =
            error.name === 'AbortError' || error.message?.includes('timeout');

          // Open circuit breaker for timeout/abort errors
          const newCount = current.count + (isTimeoutError ? 2 : 1);
          failedRequests.set(cacheKey, {
            count: newCount,
            lastFailed: Date.now(),
            circuitOpen: isTimeoutError || newCount >= MAX_RETRY_COUNT,
          });

          if (isMountedRef.current) {
            setLinkingAnnotations([]);
            setIconStates({});
          }
        } finally {
          clearTimeout(timeoutId);
          if (isMountedRef.current) {
            setIsLoading(false);
          }
          pendingRequests.delete(requestKey);
        }
      })();

      pendingRequests.set(requestKey, {
        promise: fetchPromise,
        controller: abortController,
      });
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
