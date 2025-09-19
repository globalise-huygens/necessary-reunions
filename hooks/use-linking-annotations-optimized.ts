import type { LinkingAnnotation } from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { gzip } from 'zlib';

// Global caches and deduplication
const linkingCache = new Map<
  string,
  { data: LinkingAnnotation[]; timestamp: number; etag?: string }
>();
const pendingLinkingRequests = new Map<string, Promise<any>>();
const abortControllers = new Map<string, AbortController>();

const CACHE_DURATION = 30000; // 30 seconds cache
const MAX_CACHE_SIZE = 50;

interface OptimizedLinkingFetchResult {
  linkingAnnotations: LinkingAnnotation[];
  fromCache: boolean;
  duration: number;
}

export const invalidateLinkingCacheOptimized = (canvasId?: string) => {
  if (canvasId) {
    linkingCache.delete(canvasId);
    pendingLinkingRequests.delete(`linking-${canvasId}`);
  } else {
    linkingCache.clear();
    pendingLinkingRequests.clear();
  }
};

export function useLinkingAnnotationsOptimized(canvasId: string) {
  const [linkingAnnotations, setLinkingAnnotations] = useState<
    LinkingAnnotation[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const lastFetchRef = useRef<number>(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cancel pending requests
      const controller = abortControllers.get(canvasId);
      if (controller) {
        controller.abort();
        abortControllers.delete(canvasId);
      }
    };
  }, [canvasId]);

  const fetchLinkingAnnotationsOptimized = useCallback(
    async (targetCanvasId: string): Promise<OptimizedLinkingFetchResult> => {
      const startTime = Date.now();
      const cacheKey = targetCanvasId;
      const requestKey = `linking-${targetCanvasId}`;

      // Check cache first
      const cached = linkingCache.get(cacheKey);
      const now = Date.now();

      if (cached && now - cached.timestamp < CACHE_DURATION) {
        return {
          linkingAnnotations: cached.data,
          fromCache: true,
          duration: Date.now() - startTime,
        };
      }

      // Check if request is already in flight
      if (pendingLinkingRequests.has(requestKey)) {
        try {
          const result = await pendingLinkingRequests.get(requestKey);
          return {
            linkingAnnotations: result,
            fromCache: false,
            duration: Date.now() - startTime,
          };
        } catch (error) {
          // Request failed, continue with new request
        }
      }

      // Create abort controller
      const controller = new AbortController();
      abortControllers.set(targetCanvasId, controller);

      const requestPromise = (async (): Promise<LinkingAnnotation[]> => {
        try {
          const url = `/api/annotations/linking?canvasId=${encodeURIComponent(
            targetCanvasId,
          )}`;

          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'Accept-Encoding': 'gzip, deflate, br',
              'Cache-Control': 'no-cache', // Ensure fresh data from server cache
            },
          });

          if (response.ok) {
            const data = await response.json();
            const annotations = data.annotations || [];

            // Cache the result
            linkingCache.set(cacheKey, {
              data: annotations,
              timestamp: now,
              etag: response.headers.get('etag') || undefined,
            });

            // Cleanup old cache entries
            if (linkingCache.size > MAX_CACHE_SIZE) {
              const entries = Array.from(linkingCache.entries());
              entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

              // Remove oldest 10 entries
              for (let i = 0; i < 10 && i < entries.length; i++) {
                linkingCache.delete(entries[i][0]);
              }
            }

            return annotations;
          } else {
            console.warn(
              'Linking annotations API returned status:',
              response.status,
            );
            return [];
          }
        } finally {
          pendingLinkingRequests.delete(requestKey);
          abortControllers.delete(targetCanvasId);
        }
      })();

      pendingLinkingRequests.set(requestKey, requestPromise);

      try {
        const result = await requestPromise;
        return {
          linkingAnnotations: result,
          fromCache: false,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        pendingLinkingRequests.delete(requestKey);
        throw error;
      }
    },
    [],
  );

  const fetchLinkingAnnotations = useCallback(async () => {
    if (!canvasId) {
      if (isMountedRef.current) {
        setLinkingAnnotations([]);
        setIsLoading(false);
        setError(null);
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

    try {
      const result = await fetchLinkingAnnotationsOptimized(canvasId);

      if (isMountedRef.current) {
        setLinkingAnnotations(result.linkingAnnotations);
        lastFetchRef.current = now;

        // Log performance in development
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `Linking annotations loaded: ${result.linkingAnnotations.length} items, ${result.duration}ms, cached: ${result.fromCache}`,
          );
        }
      }
    } catch (error) {
      if (isMountedRef.current && (error as Error).name !== 'AbortError') {
        console.error('Failed to fetch linking annotations:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setLinkingAnnotations([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [canvasId, fetchLinkingAnnotationsOptimized]);

  useEffect(() => {
    fetchLinkingAnnotations();
  }, [fetchLinkingAnnotations]);

  // Optimized create function with optimistic updates
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

        // Update cache optimistically
        const cached = linkingCache.get(canvasId);
        if (cached) {
          linkingCache.set(canvasId, {
            ...cached,
            data: [...cached.data, optimisticAnnotation],
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

          // Rollback cache
          const rollbackCached = linkingCache.get(canvasId);
          if (rollbackCached) {
            linkingCache.set(canvasId, {
              ...rollbackCached,
              data: rollbackCached.data.filter(
                (la) => la.id !== optimisticAnnotation.id,
              ),
            });
          }

          let errorMessage = `Failed to create linking annotation: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            // Use default error message
          }

          if (response.status === 409) {
            errorMessage =
              'Linking annotation conflict - annotations may already be linked';
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

        // Update cache with real annotation
        const successCached = linkingCache.get(canvasId);
        if (successCached) {
          const updatedData = successCached.data.map((la) =>
            la.id === optimisticAnnotation.id ? created : la,
          );
          linkingCache.set(canvasId, {
            ...successCached,
            data: updatedData,
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

  // Other CRUD operations with similar optimizations...
  const updateLinkingAnnotation = useCallback(
    async (linkingAnnotation: LinkingAnnotation) => {
      // Similar pattern to create but for updates
      // Implementation omitted for brevity - follows same pattern
      throw new Error('Not implemented yet');
    },
    [canvasId],
  );

  const deleteLinkingAnnotation = useCallback(
    async (linkingAnnotationId: string) => {
      // Similar pattern for deletions
      // Implementation omitted for brevity
      throw new Error('Not implemented yet');
    },
    [canvasId],
  );

  // Utility functions
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

  // Cache management
  const invalidateCache = useCallback(() => {
    linkingCache.delete(canvasId);
    fetchLinkingAnnotations();
  }, [canvasId, fetchLinkingAnnotations]);

  const forceRefresh = useCallback(async () => {
    linkingCache.delete(canvasId);
    lastFetchRef.current = 0;
    await fetchLinkingAnnotations();
  }, [canvasId, fetchLinkingAnnotations]);

  return {
    linkingAnnotations,
    isLoading,
    error,
    createLinkingAnnotation,
    updateLinkingAnnotation,
    deleteLinkingAnnotation,
    getLinkingAnnotationForTarget,
    getLinkedAnnotations,
    isAnnotationLinked,
    refetch: fetchLinkingAnnotations,
    clearCache: () => linkingCache.clear(),
    invalidateCache,
    forceRefresh,
    cacheSize: linkingCache.size,

    // New optimized methods
    invalidateCanvasCache: () => invalidateLinkingCacheOptimized(canvasId),
  };
}
