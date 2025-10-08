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
const CACHE_DURATION = 300000; // Increased to 5 minutes for bulk linking data (it changes rarely)
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
const REQUEST_TIMEOUT = 12000; // 12s for Netlify compatibility (leave 2s buffer for aborts)

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

  // Create a stable cache key to ensure all instances share the same data
  const cacheKey = `bulk-${targetCanvasId || 'no-canvas'}`;

  // Track canvas changes
  const previousCanvasRef = useRef<string>('');
  const currentBatchRef = useRef<number>(0);

  // Progressive loading function - bypasses cache for additional batches
  const loadMoreAnnotations = useCallback(async () => {
    // Enhanced validation to prevent cross-canvas issues
    if (!targetCanvasId || !hasMore || isLoadingMore) {
      return;
    }

    // Validate that we're still on the same canvas
    if (targetCanvasId !== previousCanvasRef.current) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const url = `/api/annotations/linking-bulk?targetCanvasId=${encodeURIComponent(
        targetCanvasId,
      )}&mode=full&batch=${currentBatchRef.current}`;

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

        // Merge with existing data
        setLinkingAnnotations((prev) => {
          const merged = [...prev, ...newAnnotations];
          return merged;
        });
        setIconStates((prev) => ({ ...prev, ...newStates }));
        setHasMore(data.hasMore || false);

        const newProcessed =
          data.processedAnnotations + loadingProgress.processed;
        setLoadingProgress({
          processed: newProcessed,
          total: data.totalAnnotations,
          mode: 'full',
        });

        currentBatchRef.current = data.nextBatch || currentBatchRef.current + 1;

        // Update cache with new data
        const cacheKey = `bulk-${targetCanvasId}`;
        const existingCache = bulkLinkingCache.get(cacheKey);
        if (existingCache) {
          const allAnnotations = [...existingCache.data, ...newAnnotations];
          bulkLinkingCache.set(cacheKey, {
            ...existingCache,
            data: allAnnotations,
            iconStates: { ...existingCache.iconStates, ...newStates },
            hasMore: data.hasMore || false,
            totalAnnotations: data.totalAnnotations,
            loadingProgress: {
              processed: newProcessed,
              total: data.totalAnnotations,
              mode: 'full',
            },
          });
        }

        // Continue loading if there's more data - let the effect handle triggering
        if (data.hasMore) {
        } else {
          // All batches complete!
        }
      } else {
        console.error(
          `[PROGRESSIVE] API error: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      console.warn('Failed to load more annotations:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [targetCanvasId, hasMore, isLoadingMore, loadingProgress.processed]);

  // Separate effect for triggering progressive loading
  useEffect(() => {
    // Only trigger if we have a valid canvas and the conditions are right
    if (
      !targetCanvasId ||
      !hasMore ||
      isLoading ||
      isLoadingMore ||
      totalAnnotations === 0
    ) {
      return;
    }

    const shouldTriggerProgressive =
      linkingAnnotations.length < totalAnnotations;

    if (shouldTriggerProgressive) {
      const timer = setTimeout(() => {
        // Double-check canvas hasn't changed
        if (
          isMountedRef.current &&
          targetCanvasId === previousCanvasRef.current &&
          hasMore &&
          !isLoadingMore
        ) {
          loadMoreAnnotations();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [hasMore, isLoading, isLoadingMore, totalAnnotations, targetCanvasId]);
  useEffect(() => {
    if (targetCanvasId !== previousCanvasRef.current) {
      const oldCanvasId = previousCanvasRef.current;
      previousCanvasRef.current = targetCanvasId;

      // Reset batch counter for new canvas
      currentBatchRef.current = 0;

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
      if (isMountedRef.current) {
        setLinkingAnnotations([]);
        setIconStates({});
        setIsLoading(false);
        setIsLoadingMore(false);
        setHasMore(false);
        setTotalAnnotations(0);
        setLoadingProgress({ processed: 0, total: 0, mode: 'quick' });
      }
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

      // Single cache check at the beginning
      const cached = bulkLinkingCache.get(cacheKey);
      const currentTime = Date.now();

      if (cached && currentTime - cached.timestamp < CACHE_DURATION) {
        if (isMountedRef.current) {
          setLinkingAnnotations(cached.data);
          setIconStates(cached.iconStates);
          setIsLoading(false);

          // Restore progressive loading state from cache
          setHasMore(cached.hasMore);
          setTotalAnnotations(cached.totalAnnotations);
          setLoadingProgress(cached.loadingProgress);
        }
        return;
      } // Check if there's already a pending request for this canvas
      const currentRequestKey = `bulk-fetch-${targetCanvasId}`;
      const currentRequest = pendingRequests.get(currentRequestKey);
      if (currentRequest) {
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
          // Silently handle pending request failures
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

      // Cache was already checked at the beginning, proceed with loading state
      if (isMountedRef.current) {
        setLinkingAnnotations([]);
        setIconStates({});
        setIsLoading(true);
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
          // Start with quick mode for immediate response
          const url = `/api/annotations/linking-bulk?targetCanvasId=${encodeURIComponent(
            targetCanvasId,
          )}&mode=quick&batch=0`;

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

            // Update progressive loading state
            setHasMore(data.hasMore || false);
            setTotalAnnotations(data.totalAnnotations || 0);
            setLoadingProgress({
              processed: data.processedAnnotations || 0,
              total: data.totalAnnotations || 0,
              mode: data.mode || 'quick',
            });

            currentBatchRef.current = data.nextBatch || 1;

            // Cache with canvas-specific key
            bulkLinkingCache.set(cacheKey, {
              data: annotations,
              iconStates: states,
              hasMore: data.hasMore || false,
              totalAnnotations: data.totalAnnotations || 0,
              loadingProgress: {
                processed: data.processedAnnotations || 0,
                total: data.totalAnnotations || 0,
                mode: data.mode || 'quick',
              },
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
              }

              failedRequests.set(cacheKey, {
                count: newCount,
                lastFailed: Date.now(),
                circuitOpen: newCount >= 3,
              });

              if (newCount >= 3) {
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
    // Progressive loading features
    isLoadingMore,
    hasMore,
    totalAnnotations,
    loadingProgress,
    loadMoreAnnotations,
    // Existing features
    getLinkingAnnotationForTarget,
    isAnnotationLinked,
    refetch,
    forceRefresh: forceRefresh,
    invalidateCache,
  };
}
