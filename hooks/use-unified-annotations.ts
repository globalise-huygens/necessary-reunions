import type { Annotation, LinkingAnnotation } from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';

// Unified cache for parallel fetching
interface UnifiedCacheEntry {
  annotations: Annotation[];
  linkingAnnotations: LinkingAnnotation[];
  timestamp: number;
  etag?: string;
}

const unifiedCache = new Map<string, UnifiedCacheEntry>();
const unifiedPendingRequests = new Map<string, Promise<any>>();
const unifiedAbortControllers = new Map<string, AbortController>();

const UNIFIED_CACHE_TTL = 30 * 1000; // 30 seconds
const MAX_UNIFIED_CACHE_SIZE = 20;

interface UnifiedFetchResult {
  annotations: Annotation[];
  linkingAnnotations: LinkingAnnotation[];
  fromCache: boolean;
  duration: number;
  annotationCount: number;
  linkingCount: number;
}

export function useUnifiedAnnotations(canvasId: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [linkingAnnotations, setLinkingAnnotations] = useState<
    LinkingAnnotation[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [performance, setPerformance] = useState<{
    duration: number;
    fromCache: boolean;
  } | null>(null);

  const isMountedRef = useRef(true);
  const lastFetchRef = useRef<number>(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cancel any pending requests
      const controller = unifiedAbortControllers.get(canvasId);
      if (controller) {
        controller.abort();
        unifiedAbortControllers.delete(canvasId);
      }
    };
  }, [canvasId]);

  const fetchUnifiedData = useCallback(
    async (targetCanvasId: string): Promise<UnifiedFetchResult> => {
      const startTime = Date.now();
      const cacheKey = targetCanvasId;
      const requestKey = `unified-${targetCanvasId}`;

      // Check cache first
      const cached = unifiedCache.get(cacheKey);
      const now = Date.now();

      if (cached && now - cached.timestamp < UNIFIED_CACHE_TTL) {
        return {
          annotations: cached.annotations,
          linkingAnnotations: cached.linkingAnnotations,
          fromCache: true,
          duration: Date.now() - startTime,
          annotationCount: cached.annotations.length,
          linkingCount: cached.linkingAnnotations.length,
        };
      }

      // Check for existing request
      if (unifiedPendingRequests.has(requestKey)) {
        try {
          const result = await unifiedPendingRequests.get(requestKey);
          return {
            ...result,
            duration: Date.now() - startTime,
          };
        } catch (error) {
          // Continue with new request
        }
      }

      // Create abort controller
      const controller = new AbortController();
      unifiedAbortControllers.set(targetCanvasId, controller);

      const requestPromise = (async (): Promise<
        Omit<UnifiedFetchResult, 'duration'>
      > => {
        try {
          // Fetch both annotation types in parallel
          const [annotationsResult, linkingResult] = await Promise.allSettled([
            // Regular annotations
            (async () => {
              const allAnnotations: Annotation[] = [];

              // Parallel fetch of external and local annotations
              const [externalPromise, localPromise] = await Promise.allSettled([
                // External annotations
                (async () => {
                  const external: Annotation[] = [];
                  let page = 0;
                  let hasMore = true;

                  while (hasMore && !controller.signal.aborted) {
                    try {
                      const response = await fetch(
                        `/api/annotations/external-optimized?targetCanvasId=${encodeURIComponent(
                          targetCanvasId,
                        )}&page=${page}`,
                        {
                          signal: controller.signal,
                          headers: { 'Accept-Encoding': 'gzip, deflate, br' },
                        },
                      );

                      if (response.ok) {
                        const { items, hasMore: more } = await response.json();
                        external.push(...(items || []));
                        hasMore = more;
                        page++;

                        // Small delay to prevent API overwhelming
                        if (hasMore && page > 0) {
                          await new Promise((resolve) =>
                            setTimeout(resolve, 5),
                          );
                        }
                      } else {
                        break;
                      }
                    } catch (err) {
                      if ((err as Error).name === 'AbortError') throw err;
                      console.warn('External annotations fetch error:', err);
                      break;
                    }
                  }

                  return external;
                })(),

                // Local annotations
                (async () => {
                  try {
                    const response = await fetch(
                      `/api/annotations/local-optimized?canvasId=${encodeURIComponent(
                        targetCanvasId,
                      )}`,
                      {
                        signal: controller.signal,
                        headers: { 'Accept-Encoding': 'gzip, deflate, br' },
                      },
                    );

                    if (response.ok) {
                      const { annotations } = await response.json();
                      return Array.isArray(annotations) ? annotations : [];
                    }
                    return [];
                  } catch (err) {
                    if ((err as Error).name === 'AbortError') throw err;
                    console.warn('Local annotations fetch error:', err);
                    return [];
                  }
                })(),
              ]);

              // Combine results
              if (externalPromise.status === 'fulfilled') {
                allAnnotations.push(...externalPromise.value);
              }
              if (localPromise.status === 'fulfilled') {
                allAnnotations.push(...localPromise.value);
              }

              return allAnnotations;
            })(),

            // Linking annotations
            (async () => {
              try {
                const response = await fetch(
                  `/api/annotations/linking-bulk?canvasId=${encodeURIComponent(
                    targetCanvasId,
                  )}`,
                  {
                    signal: controller.signal,
                    headers: { 'Accept-Encoding': 'gzip, deflate, br' },
                  },
                );

                if (response.ok) {
                  const data = await response.json();
                  return data.annotations || [];
                }
                return [];
              } catch (err) {
                if ((err as Error).name === 'AbortError') throw err;
                console.warn('Linking annotations fetch error:', err);
                return [];
              }
            })(),
          ]);

          const finalAnnotations =
            annotationsResult.status === 'fulfilled'
              ? annotationsResult.value
              : [];
          const finalLinkingAnnotations =
            linkingResult.status === 'fulfilled' ? linkingResult.value : [];

          // Cache the unified result
          unifiedCache.set(cacheKey, {
            annotations: finalAnnotations,
            linkingAnnotations: finalLinkingAnnotations,
            timestamp: now,
          });

          // Cleanup old cache entries
          if (unifiedCache.size > MAX_UNIFIED_CACHE_SIZE) {
            const entries = Array.from(unifiedCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

            // Remove oldest 5 entries
            for (let i = 0; i < 5 && i < entries.length; i++) {
              unifiedCache.delete(entries[i][0]);
            }
          }

          return {
            annotations: finalAnnotations,
            linkingAnnotations: finalLinkingAnnotations,
            fromCache: false,
            annotationCount: finalAnnotations.length,
            linkingCount: finalLinkingAnnotations.length,
          };
        } finally {
          unifiedPendingRequests.delete(requestKey);
          unifiedAbortControllers.delete(targetCanvasId);
        }
      })();

      unifiedPendingRequests.set(requestKey, requestPromise);

      try {
        const result = await requestPromise;
        return {
          ...result,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        unifiedPendingRequests.delete(requestKey);
        throw error;
      }
    },
    [],
  );

  // Main fetch effect
  useEffect(() => {
    let cancelled = false;

    if (!canvasId) {
      if (isMountedRef.current) {
        setAnnotations([]);
        setLinkingAnnotations([]);
        setIsLoading(false);
        setError(null);
        setPerformance(null);
      }
      return;
    }

    // Skip if recent fetch (within 5 seconds)
    const now = Date.now();
    if (now - lastFetchRef.current < 5000) {
      return;
    }

    if (isMountedRef.current) {
      setIsLoading(true);
      setError(null);
    }

    (async () => {
      try {
        const result = await fetchUnifiedData(canvasId);

        if (!cancelled && isMountedRef.current) {
          setAnnotations(result.annotations);
          setLinkingAnnotations(result.linkingAnnotations);
          setPerformance({
            duration: result.duration,
            fromCache: result.fromCache,
          });
          lastFetchRef.current = now;

          // Log performance metrics in development
          if (process.env.NODE_ENV === 'development') {
            console.log(
              `🚀 Unified fetch: ${result.annotationCount} annotations + ${result.linkingCount} linking annotations, ${result.duration}ms, cached: ${result.fromCache}`,
            );
          }
        }
      } catch (err) {
        if (
          !cancelled &&
          isMountedRef.current &&
          (err as Error).name !== 'AbortError'
        ) {
          console.error('Failed to fetch unified annotations:', err);
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
  }, [canvasId, fetchUnifiedData]);

  // Cache management functions
  const refresh = useCallback(() => {
    unifiedCache.delete(canvasId);
    unifiedPendingRequests.delete(`unified-${canvasId}`);
    lastFetchRef.current = 0; // Force re-fetch
  }, [canvasId]);

  const invalidateCache = useCallback(() => {
    unifiedCache.clear();
    unifiedPendingRequests.clear();
  }, []);

  // Create optimistic linking annotation
  const createLinkingAnnotation = useCallback(
    async (linkingAnnotation: LinkingAnnotation) => {
      try {
        const optimisticAnnotation = {
          ...linkingAnnotation,
          id: linkingAnnotation.id || `temp-${Date.now()}`,
          _isOptimistic: true,
        };

        // Optimistic update
        if (isMountedRef.current) {
          setLinkingAnnotations((prev) => [...prev, optimisticAnnotation]);
        }

        // Update cache
        const cached = unifiedCache.get(canvasId);
        if (cached) {
          unifiedCache.set(canvasId, {
            ...cached,
            linkingAnnotations: [
              ...cached.linkingAnnotations,
              optimisticAnnotation,
            ],
            timestamp: Date.now(),
          });
        }

        const response = await fetch('/api/annotations/linking', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
          },
          body: JSON.stringify(linkingAnnotation),
        });

        if (!response.ok) {
          // Rollback optimistic update
          if (isMountedRef.current) {
            setLinkingAnnotations((prev) =>
              prev.filter((la) => la.id !== optimisticAnnotation.id),
            );
          }

          const rollbackCached = unifiedCache.get(canvasId);
          if (rollbackCached) {
            unifiedCache.set(canvasId, {
              ...rollbackCached,
              linkingAnnotations: rollbackCached.linkingAnnotations.filter(
                (la) => la.id !== optimisticAnnotation.id,
              ),
            });
          }

          let errorMessage = `Failed to create linking annotation: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            // Use default message
          }

          throw new Error(errorMessage);
        }

        const created = await response.json();

        // Update with real annotation
        if (isMountedRef.current) {
          setLinkingAnnotations((prev) =>
            prev.map((la) =>
              la.id === optimisticAnnotation.id
                ? { ...created, _isOptimistic: false }
                : la,
            ),
          );
        }

        // Update cache
        const successCached = unifiedCache.get(canvasId);
        if (successCached) {
          unifiedCache.set(canvasId, {
            ...successCached,
            linkingAnnotations: successCached.linkingAnnotations.map((la) =>
              la.id === optimisticAnnotation.id ? created : la,
            ),
            timestamp: Date.now(),
          });
        }

        return created;
      } catch (error) {
        throw error;
      }
    },
    [canvasId],
  );

  // Utility functions for linking annotations
  const getLinkingAnnotationForTarget = useCallback(
    (annotationId: string): LinkingAnnotation | null => {
      return (
        linkingAnnotations.find((la) => {
          const targets = Array.isArray(la.target) ? la.target : [la.target];
          return targets.includes(annotationId);
        }) || null
      );
    },
    [linkingAnnotations],
  );

  const getLinkedAnnotations = useCallback(
    (annotationId: string): string[] => {
      const linkingAnnotation = getLinkingAnnotationForTarget(annotationId);
      if (!linkingAnnotation) return [];
      return linkingAnnotation.target.filter((id) => id !== annotationId);
    },
    [getLinkingAnnotationForTarget],
  );

  const isAnnotationLinked = useCallback(
    (annotationId: string): boolean => {
      return linkingAnnotations.some((la) => la.target.includes(annotationId));
    },
    [linkingAnnotations],
  );

  return {
    // Data
    annotations,
    linkingAnnotations,
    isLoading,
    error,
    performance,

    // Linking annotation utilities
    getLinkingAnnotationForTarget,
    getLinkedAnnotations,
    isAnnotationLinked,
    createLinkingAnnotation,

    // Cache management
    refresh,
    invalidateCache,
    cacheSize: unifiedCache.size,

    // Statistics
    stats: {
      annotationCount: annotations.length,
      linkingCount: linkingAnnotations.length,
      cacheHitRate: performance?.fromCache ? 1 : 0,
      lastFetchDuration: performance?.duration || 0,
    },
  };
}
