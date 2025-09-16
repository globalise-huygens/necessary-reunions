import { LinkingAnnotation } from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';

const linkingCache = new Map<
  string,
  { data: LinkingAnnotation[]; timestamp: number }
>();
const CACHE_DURATION = 30000; // Increased to 30 seconds for better performance
const pendingRequests = new Map<string, Promise<any>>();

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

    // Always invalidate cache for different canvas to ensure fresh data
    const cached = linkingCache.get(canvasId);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      if (isMountedRef.current) {
        setLinkingAnnotations(cached.data);
        setIsLoading(false);
      }
      return;
    }

    const requestKey = `fetch-${canvasId}`;
    if (pendingRequests.has(requestKey)) {
      try {
        await pendingRequests.get(requestKey);
        return;
      } catch (error) {
        console.warn('Pending request failed:', error);
      }
    }

    if (isMountedRef.current) {
      setIsLoading(true);
    }

    const fetchPromise = (async () => {
      try {
        const url = `/api/annotations/linking?canvasId=${encodeURIComponent(
          canvasId,
        )}`;

        // Add retry logic for network failures
        const maxRetries = 2;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const response = await fetch(url, {
              cache: 'no-cache',
              headers: {
                'Cache-Control': 'no-cache',
              },
            });

            if (response.ok) {
              const data = await response.json();
              const annotations = data.annotations || [];
              linkingCache.set(canvasId, { data: annotations, timestamp: now });
              if (isMountedRef.current) {
                setLinkingAnnotations(annotations);
              }
              return;
            } else {
              if (response.status >= 400 && response.status < 500) {
                // Don't retry client errors
                if (isMountedRef.current) {
                  setLinkingAnnotations([]);
                }
                return;
              }

              // Retry server errors
              if (attempt < maxRetries) {
                await new Promise((resolve) =>
                  setTimeout(resolve, 500 * (attempt + 1)),
                );
                continue;
              }

              if (isMountedRef.current) {
                setLinkingAnnotations([]);
              }
            }
          } catch (error) {
            lastError = error as Error;

            // Retry network errors
            if (attempt < maxRetries) {
              console.warn(
                `Linking annotations fetch attempt ${
                  attempt + 1
                } failed, retrying...`,
                error,
              );
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * (attempt + 1)),
              );
              continue;
            }
          }
        }

        console.error(
          'Failed to fetch linking annotations after retries:',
          lastError,
        );
        if (isMountedRef.current) {
          setLinkingAnnotations([]);
        }
      } catch (error) {
        console.error('Error in linking annotations fetch:', error);
        if (isMountedRef.current) {
          setLinkingAnnotations([]);
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
  }, [canvasId]);

  // Invalidate cache when canvas changes
  useEffect(() => {
    // Clear cache for this canvas to ensure fresh data
    linkingCache.delete(canvasId);
    // Also clear pending requests for different canvas
    pendingRequests.forEach((promise, key) => {
      if (!key.endsWith(`-${canvasId}`)) {
        pendingRequests.delete(key);
      }
    });
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
