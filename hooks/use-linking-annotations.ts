import { LinkingAnnotation } from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';

const linkingCache = new Map<
  string,
  { data: LinkingAnnotation[]; timestamp: number }
>();
const CACHE_DURATION = 30000; // Increased to 30 seconds for better performance
const pendingRequests = new Map<
  string,
  { promise: Promise<any>; controller: AbortController }
>();
const failedRequests = new Map<
  string,
  { count: number; lastFailed: number; circuitOpen: boolean }
>();
const MAX_RETRY_COUNT = 5;
const RETRY_BACKOFF_MS = 15000;
const CIRCUIT_BREAKER_TIMEOUT = 60000;
const REQUEST_TIMEOUT = 30000; // 30s request timeout

export const invalidateLinkingCache = (canvasId?: string) => {
  if (canvasId) {
    linkingCache.delete(canvasId);
  } else {
    linkingCache.clear();
  }
};

export function useLinkingAnnotations(canvasId: string) {
  const [linkingAnnotations, setLinkingAnnotations] = useState<
    LinkingAnnotation[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchLinkingAnnotations = useCallback(async () => {
    if (!canvasId) {
      if (isMountedRef.current) {
        setLinkingAnnotations([]);
        setIsLoading(false);
      }
      return;
    }

    // Emergency brake: Check if URL is blocked by global request blocker
    const url = `/api/annotations/linking?canvasId=${encodeURIComponent(
      canvasId,
    )}`;

    // Check for existing pending request but be more permissive
    const emergencyRequestKey = `fetch-${canvasId}`;
    const emergencyPendingRequest = pendingRequests.get(emergencyRequestKey);
    if (emergencyPendingRequest) {
      try {
        await emergencyPendingRequest.promise;
        // Re-check cache after pending request completes
        const freshCache = linkingCache.get(canvasId);
        if (freshCache && isMountedRef.current) {
          setLinkingAnnotations(freshCache.data);
          setIsLoading(false);
        }
        return;
      } catch (error) {
        // Allow fresh fetch if pending request failed
      }
    }

    // Check circuit breaker
    const failureInfo = failedRequests.get(canvasId);
    const now = Date.now();
    if (failureInfo) {
      if (failureInfo.circuitOpen) {
        const timeSinceFailure = now - failureInfo.lastFailed;
        if (timeSinceFailure < CIRCUIT_BREAKER_TIMEOUT) {
          // Circuit breaker open - preventing request
          if (isMountedRef.current) {
            setLinkingAnnotations([]);
            setIsLoading(false);
          }
          return;
        } else {
          failedRequests.delete(canvasId);
        }
      }

      if (failureInfo.count >= MAX_RETRY_COUNT) {
        const timeSinceLastFailure = now - failureInfo.lastFailed;
        if (timeSinceLastFailure < RETRY_BACKOFF_MS) {
          // Too many failures - backing off
          if (isMountedRef.current) {
            setLinkingAnnotations([]);
            setIsLoading(false);
          }
          return;
        } else {
          failedRequests.delete(canvasId);
        }
      }
    }

    const cached = linkingCache.get(canvasId);

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      if (isMountedRef.current) {
        setLinkingAnnotations(cached.data);
        setIsLoading(false);
      }
      return;
    }

    // Clear any stale pending requests for this canvas
    const requestKey = `fetch-${canvasId}`;
    const existingRequest = pendingRequests.get(requestKey);
    if (existingRequest) {
      // Don't wait for existing request, just abort it and start fresh
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

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, REQUEST_TIMEOUT);

    const fetchPromise = (async () => {
      try {
        const url = `/api/annotations/linking?canvasId=${encodeURIComponent(
          canvasId,
        )}`;
        const response = await fetch(url, {
          signal: abortController.signal,
          cache: 'no-cache',
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const annotations = data.annotations || [];
          linkingCache.set(canvasId, { data: annotations, timestamp: now });

          // Clear failure count on success
          failedRequests.delete(canvasId);

          if (isMountedRef.current) {
            setLinkingAnnotations(annotations);
          }
        } else {
          // Linking API failed

          const current = failedRequests.get(canvasId) || {
            count: 0,
            lastFailed: 0,
            circuitOpen: false,
          };

          // Open circuit breaker for 502/504 errors - but only after multiple failures
          if (response.status === 502 || response.status === 504) {
            const newCount = current.count + 1;

            // Only block after 3+ failures
            if (newCount >= 3) {
              // Removed request blocking - circuit breaker pattern only in memory
            }

            failedRequests.set(canvasId, {
              count: newCount,
              lastFailed: Date.now(),
              circuitOpen: newCount >= 3,
            });
          } else {
            const newCount = current.count + 1;
            failedRequests.set(canvasId, {
              count: newCount,
              lastFailed: Date.now(),
              circuitOpen: newCount >= MAX_RETRY_COUNT,
            });
          }

          if (isMountedRef.current) {
            setLinkingAnnotations([]);
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

        // Linking API error occurred

        const current = failedRequests.get(canvasId) || {
          count: 0,
          lastFailed: 0,
          circuitOpen: false,
        };

        const isTimeoutError = error.message?.includes('timeout');
        const newCount = current.count + (isTimeoutError ? 2 : 1);
        failedRequests.set(canvasId, {
          count: newCount,
          lastFailed: Date.now(),
          circuitOpen: isTimeoutError || newCount >= MAX_RETRY_COUNT,
        });

        if (isMountedRef.current) {
          setLinkingAnnotations([]);
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
  }, [canvasId]);

  useEffect(() => {
    fetchLinkingAnnotations();
  }, [fetchLinkingAnnotations]);

  const createLinkingAnnotation = useCallback(
    async (linkingAnnotation: LinkingAnnotation) => {
      try {
        const optimisticAnnotation = {
          ...linkingAnnotation,
          id: linkingAnnotation.id || `temp-${Date.now()}`,
          _isOptimistic: true,
        };

        if (isMountedRef.current) {
          setLinkingAnnotations((prev) => [...prev, optimisticAnnotation]);
        }

        const optimisticCached = linkingCache.get(canvasId);
        if (optimisticCached) {
          linkingCache.set(canvasId, {
            data: [...optimisticCached.data, optimisticAnnotation],
            timestamp: Date.now(),
          });
        }

        const response = await fetch('/api/annotations/linking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(linkingAnnotation),
        });

        if (!response.ok) {
          if (isMountedRef.current) {
            setLinkingAnnotations((prev) =>
              prev.filter((la) => la.id !== optimisticAnnotation.id),
            );
          }

          const rollbackCached = linkingCache.get(canvasId);
          if (rollbackCached) {
            linkingCache.set(canvasId, {
              data: rollbackCached.data.filter(
                (la) => la.id !== optimisticAnnotation.id,
              ),
              timestamp: Date.now(),
            });
          }

          let errorMessage = `Failed to create linking annotation: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            errorMessage = `Failed to create linking annotation: ${response.status} ${response.statusText}`;
          }

          if (response.status === 409) {
            throw new Error('One or more annotations are already linked');
          }
          throw new Error(errorMessage);
        }

        const created = await response.json();

        if (isMountedRef.current) {
          setLinkingAnnotations((prev) =>
            prev.map((la) =>
              la.id === optimisticAnnotation.id
                ? { ...created, _isOptimistic: false }
                : la,
            ),
          );
        }

        const successCached = linkingCache.get(canvasId);
        if (successCached) {
          const updatedData = successCached.data.map((la) =>
            la.id === optimisticAnnotation.id ? created : la,
          );
          linkingCache.set(canvasId, {
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

  const updateLinkingAnnotation = useCallback(
    async (linkingAnnotation: LinkingAnnotation) => {
      try {
        const originalAnnotations = linkingAnnotations;
        const optimisticUpdate = { ...linkingAnnotation, _isOptimistic: true };

        if (isMountedRef.current) {
          setLinkingAnnotations((prev) =>
            prev.map((la) =>
              la.id === linkingAnnotation.id ? optimisticUpdate : la,
            ),
          );
        }

        const updateCached = linkingCache.get(canvasId);
        if (updateCached) {
          linkingCache.set(canvasId, {
            data: updateCached.data.map((la) =>
              la.id === linkingAnnotation.id ? optimisticUpdate : la,
            ),
            timestamp: Date.now(),
          });
        }

        const annotationId = linkingAnnotation.id;
        const encodedId = encodeURIComponent(encodeURIComponent(annotationId));

        const response = await fetch(`/api/annotations/linking/${encodedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(linkingAnnotation),
        });

        if (!response.ok) {
          if (isMountedRef.current) {
            setLinkingAnnotations(originalAnnotations);
          }

          const rollbackUpdateCached = linkingCache.get(canvasId);
          if (rollbackUpdateCached) {
            linkingCache.set(canvasId, {
              data: rollbackUpdateCached.data.map((la) =>
                la.id === linkingAnnotation.id
                  ? originalAnnotations.find(
                      (orig) => orig.id === linkingAnnotation.id,
                    ) || la
                  : la,
              ),
              timestamp: Date.now(),
            });
          }

          let errorMessage = `Failed to update linking annotation: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            errorMessage = `Failed to update linking annotation: ${response.status} ${response.statusText}`;
          }

          if (response.status === 409) {
            throw new Error('One or more annotations are already linked');
          }
          throw new Error(errorMessage);
        }

        const updated = await response.json();

        if (isMountedRef.current) {
          setLinkingAnnotations((prev) =>
            prev.map((la) =>
              la.id === updated.id ? { ...updated, _isOptimistic: false } : la,
            ),
          );
        }

        const updateSuccessCached = linkingCache.get(canvasId);
        if (updateSuccessCached) {
          const updatedData = updateSuccessCached.data.map(
            (la: LinkingAnnotation) => (la.id === updated.id ? updated : la),
          );
          linkingCache.set(canvasId, {
            data: updatedData,
            timestamp: Date.now(),
          });
        } else {
          linkingCache.set(canvasId, {
            data: linkingAnnotations.map((la: LinkingAnnotation) =>
              la.id === updated.id ? updated : la,
            ),
            timestamp: Date.now(),
          });
        }

        return updated;
      } catch (error) {
        throw error;
      }
    },
    [linkingAnnotations, canvasId],
  );

  const deleteLinkingAnnotation = useCallback(
    async (linkingAnnotationId: string) => {
      try {
        const originalAnnotations = linkingAnnotations;

        if (isMountedRef.current) {
          setLinkingAnnotations((prev) =>
            prev.filter((la) => la.id !== linkingAnnotationId),
          );
        }

        linkingCache.delete(canvasId);

        const encodedId = encodeURIComponent(
          encodeURIComponent(linkingAnnotationId),
        );
        const response = await fetch(`/api/annotations/linking/${encodedId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          if (isMountedRef.current) {
            setLinkingAnnotations(originalAnnotations);
          }

          let errorMessage = `Failed to delete linking annotation: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            errorMessage = `Failed to delete linking annotation: ${response.status} ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const deleteCached = linkingCache.get(canvasId);
        if (deleteCached) {
          const updatedData = deleteCached.data.filter(
            (la: LinkingAnnotation) => la.id !== linkingAnnotationId,
          );
          linkingCache.set(canvasId, {
            data: updatedData,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        throw error;
      }
    },
    [linkingAnnotations, canvasId],
  );

  const getLinkingAnnotationForTarget = useCallback(
    (annotationId: string): LinkingAnnotation | null => {
      const result =
        linkingAnnotations.find((la) => {
          const targets = Array.isArray(la.target) ? la.target : [la.target];
          return targets.includes(annotationId);
        }) || null;

      return result;
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

  const invalidateCache = useCallback(() => {
    linkingCache.delete(canvasId);
    fetchLinkingAnnotations();
  }, [canvasId, fetchLinkingAnnotations]);

  const forceRefresh = useCallback(async () => {
    linkingCache.delete(canvasId);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await fetchLinkingAnnotations();
  }, [canvasId, fetchLinkingAnnotations]);

  const forceRefreshWithPolling = useCallback(
    async (expectedCount?: number) => {
      linkingCache.delete(canvasId);
      const maxAttempts = 10;
      const initialDelay = 200;
      const maxDelay = 2000;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const delay = Math.min(initialDelay * Math.pow(1.5, attempt), maxDelay);
        await new Promise((resolve) => setTimeout(resolve, delay));

        linkingCache.delete(canvasId);
        await fetchLinkingAnnotations();

        if (expectedCount !== undefined) {
          const currentData = linkingCache.get(canvasId);
          if (currentData && currentData.data.length >= expectedCount) {
            return;
          }
        } else {
          const currentData = linkingCache.get(canvasId);
          if (currentData && Date.now() - currentData.timestamp < 1000) {
            return;
          }
        }
      }
    },
    [canvasId, fetchLinkingAnnotations],
  );

  const immediateRefresh = useCallback(async () => {
    linkingCache.delete(canvasId);
    await fetchLinkingAnnotations();
    setTimeout(async () => {
      linkingCache.delete(canvasId);
      await fetchLinkingAnnotations();
    }, 1000);
  }, [canvasId, fetchLinkingAnnotations]);

  return {
    linkingAnnotations,
    isLoading,
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
    forceRefreshWithPolling,
    immediateRefresh,
    invalidateCanvasCache: () => invalidateLinkingCache(canvasId),
  };
}
