import {
  blockRequestPermanently,
  blockRequestTemporarily,
  isRequestBlocked,
} from '@/lib/request-blocker';
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
const pendingRequests = new Map<
  string,
  { promise: Promise<any>; controller: AbortController }
>();
const failedRequests = new Map<
  string,
  { count: number; lastFailed: number; circuitOpen: boolean }
>();
const MAX_RETRY_COUNT = 5; // Allow 5 attempts
const RETRY_BACKOFF_MS = 15000; // 15 seconds backoff
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute circuit breaker
const REQUEST_TIMEOUT = 30000; // 30s request timeout

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

  // Track canvas changes
  const previousCanvasRef = useRef<string>('');

  // Clear cache and reset state when canvas changes
  useEffect(() => {
    if (targetCanvasId !== previousCanvasRef.current) {
      const oldCanvasId = previousCanvasRef.current;
      previousCanvasRef.current = targetCanvasId;

      // Clear cache for the previous canvas to prevent cross-contamination
      if (oldCanvasId) {
        const oldCacheKey = `bulk-${oldCanvasId}`;
        bulkLinkingCache.delete(oldCacheKey);
        failedRequests.delete(oldCacheKey);

        // Clean up any pending requests for the old canvas
        const oldRequestKey = `bulk-fetch-${oldCanvasId}`;
        const existingRequest = pendingRequests.get(oldRequestKey);
        if (existingRequest) {
          try {
            existingRequest.controller.abort();
          } catch (error) {
            // Ignore abort errors
          }
          pendingRequests.delete(oldRequestKey);
        }
      }

      // Reset state for new canvas
      setLinkingAnnotations([]);
      setIconStates({});
      setIsLoading(false);
    }
  }, [targetCanvasId]);

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

      // Check cache first before doing anything else
      const currentCache = bulkLinkingCache.get(cacheKey);
      const currentTime = Date.now();

      if (
        currentCache &&
        currentTime - currentCache.timestamp < CACHE_DURATION
      ) {
        console.log(`Using cached data for canvas: ${targetCanvasId}`);
        if (isMountedRef.current) {
          setLinkingAnnotations(currentCache.data);
          setIconStates(currentCache.iconStates);
          setIsLoading(false);
        }
        return;
      }

      // Check if there's already a pending request for this canvas
      const currentRequestKey = `bulk-fetch-${targetCanvasId}`;
      const currentRequest = pendingRequests.get(currentRequestKey);
      if (currentRequest) {
        console.log(
          `Request already in progress for canvas: ${targetCanvasId}`,
        );
        // Wait for the existing request instead of starting a new one
        try {
          await currentRequest.promise;
          // Check cache again after the request completes
          const freshCache = bulkLinkingCache.get(cacheKey);
          if (freshCache && isMountedRef.current) {
            setLinkingAnnotations(freshCache.data);
            setIconStates(freshCache.iconStates);
            setIsLoading(false);
          }
        } catch (error) {
          console.log(`Pending request failed for ${targetCanvasId}:`, error);
        }
        return;
      }
      const failureInfo = failedRequests.get(cacheKey);
      const timeNow = Date.now();
      if (failureInfo) {
        // Check if circuit breaker is open
        if (failureInfo.circuitOpen) {
          const timeSinceFailure = timeNow - failureInfo.lastFailed;
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
          const timeSinceLastFailure = timeNow - failureInfo.lastFailed;
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

      if (cached && timeNow - cached.timestamp < CACHE_DURATION) {
        if (isMountedRef.current) {
          setLinkingAnnotations(cached.data);
          setIconStates(cached.iconStates);
          setIsLoading(false);
        }
        return;
      }

      // Clear any stale pending requests for this canvas
      const requestKey = `bulk-fetch-${targetCanvasId}`;
      const existingRequest = pendingRequests.get(requestKey);
      if (existingRequest) {
        // Don't wait, just abort and start fresh to prevent endless loading
        try {
          existingRequest.controller.abort();
        } catch (error) {
          // Ignore abort errors
        }
        pendingRequests.delete(requestKey);
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
              timestamp: timeNow,
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

            // For 502/504 errors, temporarily disable requests - but only after multiple failures
            if (response.status === 502 || response.status === 504) {
              const newCount = current.count + 1;

              // Only block after 3+ failures
              if (newCount >= 3) {
                blockRequestTemporarily(url, 30000); // Block for 30 seconds only
                console.log(
                  `Multiple gateway errors (${newCount}), temporarily blocking bulk API`,
                );
              }

              failedRequests.set(cacheKey, {
                count: newCount,
                lastFailed: Date.now(),
                circuitOpen: newCount >= 3,
              });

              if (newCount >= 3) {
                console.log(
                  `Gateway timeout ${response.status}, circuit breaker opened temporarily`,
                );
              }
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

          // Handle AbortError specially - it's expected behavior, not an error
          if (error.name === 'AbortError') {
            console.log(
              `Bulk API request aborted for canvas: ${targetCanvasId}`,
            );
            // Don't treat abort as a failure - just clean up
            if (isMountedRef.current) {
              setIsLoading(false);
            }
            return;
          }

          console.warn(`Bulk linking API error:`, error);

          const current = failedRequests.get(cacheKey) || {
            count: 0,
            lastFailed: 0,
            circuitOpen: false,
          };

          // Check if it's a timeout error (but not abort)
          const isTimeoutError = error.message?.includes('timeout');

          // Open circuit breaker for timeout errors only
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
  }, [targetCanvasId, refreshTrigger]);

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
    invalidateBulkLinkingCache(targetCanvasId);
    setRefreshTrigger((prev) => prev + 1);
  }, [targetCanvasId]);

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
