import type { Annotation } from '@/lib/types';
import { fetchAnnotations } from '@/lib/viewer/annoRepo';
import { useCallback, useEffect, useRef, useState } from 'react';

// Global request deduplication cache
const pendingRequests = new Map<string, Promise<any>>();
const requestCache = new Map<
  string,
  { data: Annotation[]; timestamp: number; etag?: string }
>();
const CACHE_TTL = 30 * 1000; // 30 seconds

// Global abort controllers for cleanup
const abortControllers = new Map<string, AbortController>();

interface OptimizedFetchResult {
  annotations: Annotation[];
  fromCache: boolean;
  duration: number;
}

export function useAllAnnotationsOptimized(canvasId: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const isMountedRef = useRef(true);
  const currentCanvasRef = useRef<string>('');

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cancel any pending requests for this component
      const controller = abortControllers.get(canvasId);
      if (controller) {
        controller.abort();
        abortControllers.delete(canvasId);
      }
    };
  }, [canvasId]);

  // Optimized fetch function with deduplication
  const fetchAnnotationsOptimized = useCallback(
    async (targetCanvasId: string): Promise<OptimizedFetchResult> => {
      const startTime = Date.now();
      const cacheKey = `annotations-${targetCanvasId}`;

      // Check cache first
      const cached = requestCache.get(cacheKey);
      const now = Date.now();

      if (cached && now - cached.timestamp < CACHE_TTL) {
        return {
          annotations: cached.data,
          fromCache: true,
          duration: Date.now() - startTime,
        };
      }

      // Check if request is already in flight
      if (pendingRequests.has(cacheKey)) {
        try {
          const result = await pendingRequests.get(cacheKey);
          return {
            annotations: result,
            fromCache: false,
            duration: Date.now() - startTime,
          };
        } catch (error) {
          // Request failed, continue with new request
        }
      }

      // Create new request with abort signal
      const controller = new AbortController();
      abortControllers.set(targetCanvasId, controller);

      const requestPromise = (async (): Promise<Annotation[]> => {
        try {
          const all: Annotation[] = [];

          // Fetch external and local annotations in parallel
          const [externalPromise, localPromise] = await Promise.allSettled([
            // External annotations with optimized API
            (async () => {
              const externalAnnotations: Annotation[] = [];
              let page = 0;
              let hasMore = true;

              while (
                hasMore &&
                !controller.signal.aborted &&
                isMountedRef.current
              ) {
                try {
                  const response = await fetch(
                    `/api/annotations/external-optimized?targetCanvasId=${encodeURIComponent(
                      targetCanvasId,
                    )}&page=${page}`,
                    {
                      signal: controller.signal,
                      headers: {
                        'Accept-Encoding': 'gzip, deflate, br',
                      },
                    },
                  );

                  if (!response.ok) {
                    console.warn(
                      `External API page ${page} failed:`,
                      response.status,
                    );
                    break;
                  }

                  const { items, hasMore: more } = await response.json();
                  externalAnnotations.push(...(items || []));
                  hasMore = more;
                  page++;

                  // Add small delay to prevent overwhelming the API
                  if (hasMore && page > 0) {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                  }
                } catch (err) {
                  if ((err as Error).name === 'AbortError') {
                    throw err; // Re-throw abort errors
                  }
                  console.error(
                    `External annotation repository error (page ${page}):`,
                    err,
                  );
                  break;
                }
              }

              return externalAnnotations;
            })(),

            // Local annotations with optimized API
            (async () => {
              try {
                const response = await fetch(
                  `/api/annotations/local-optimized?canvasId=${encodeURIComponent(
                    targetCanvasId,
                  )}`,
                  {
                    signal: controller.signal,
                    headers: {
                      'Accept-Encoding': 'gzip, deflate, br',
                    },
                  },
                );

                if (response.ok) {
                  const { annotations: localAnnotations } =
                    await response.json();
                  return Array.isArray(localAnnotations)
                    ? localAnnotations
                    : [];
                } else {
                  console.warn(
                    'Local annotations API returned status:',
                    response.status,
                  );
                  return [];
                }
              } catch (err) {
                if ((err as Error).name === 'AbortError') {
                  throw err;
                }
                console.warn('Local annotations API unavailable:', err);
                return [];
              }
            })(),
          ]);

          // Combine results
          if (externalPromise.status === 'fulfilled') {
            all.push(...externalPromise.value);
          }
          if (localPromise.status === 'fulfilled') {
            all.push(...localPromise.value);
          }

          // Cache the result
          requestCache.set(cacheKey, {
            data: all,
            timestamp: now,
          });

          // Cleanup old cache entries
          if (requestCache.size > 20) {
            const entries = Array.from(requestCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

            // Remove oldest entries
            for (let i = 0; i < 5 && i < entries.length; i++) {
              requestCache.delete(entries[i][0]);
            }
          }

          return all;
        } finally {
          // Cleanup
          pendingRequests.delete(cacheKey);
          abortControllers.delete(targetCanvasId);
        }
      })();

      // Store pending request
      pendingRequests.set(cacheKey, requestPromise);

      try {
        const result = await requestPromise;
        return {
          annotations: result,
          fromCache: false,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        pendingRequests.delete(cacheKey);
        throw error;
      }
    },
    [],
  );

  // Main effect
  useEffect(() => {
    let cancelled = false;

    if (!canvasId) {
      if (isMountedRef.current) {
        setAnnotations([]);
        setIsLoading(false);
        setError(null);
      }
      return;
    }

    // Skip if same canvas and recent fetch
    if (
      canvasId === currentCanvasRef.current &&
      Date.now() - lastFetch < 5000
    ) {
      return;
    }

    currentCanvasRef.current = canvasId;

    if (isMountedRef.current) {
      setIsLoading(true);
      setError(null);
    }

    (async () => {
      try {
        const result = await fetchAnnotationsOptimized(canvasId);

        if (!cancelled && isMountedRef.current) {
          setAnnotations(result.annotations);
          setLastFetch(Date.now());

          // Log performance metrics in development
          if (process.env.NODE_ENV === 'development') {
            console.log(
              `Annotations loaded: ${result.annotations.length} items, ${result.duration}ms, cached: ${result.fromCache}`,
            );
          }
        }
      } catch (err) {
        if (
          !cancelled &&
          isMountedRef.current &&
          (err as Error).name !== 'AbortError'
        ) {
          console.error('Failed to fetch annotations:', err);
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled && isMountedRef.current) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canvasId, fetchAnnotationsOptimized, lastFetch]);

  // Force refresh function
  const refresh = useCallback(() => {
    const cacheKey = `annotations-${canvasId}`;
    requestCache.delete(cacheKey);
    pendingRequests.delete(cacheKey);

    if (canvasId) {
      setLastFetch(0); // Force re-fetch
    }
  }, [canvasId]);

  // Cache invalidation
  const invalidateCache = useCallback(() => {
    requestCache.clear();
    pendingRequests.clear();
  }, []);

  return {
    annotations,
    isLoading,
    error,
    refresh,
    invalidateCache,
    cacheSize: requestCache.size,
  };
}
