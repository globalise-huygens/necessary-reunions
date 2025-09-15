import { cacheManager } from '@/lib/shared/cache-manager';
import type { Annotation } from '@/lib/types';
import { fetchAnnotations } from '@/lib/viewer/annoRepo';
import { useCallback, useEffect, useRef, useState } from 'react';

// Optimized version with parallel loading and centralized caching
export function useAllAnnotationsOptimized(canvasId: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isMountedRef = useRef(true);
  const pendingRequestRef = useRef<Map<string, Promise<Annotation[]>>>(
    new Map(),
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!canvasId) {
      if (isMountedRef.current) {
        setAnnotations([]);
        setIsLoading(false);
      }
      return;
    }

    // Check centralized cache first
    const cachedAnnotations = cacheManager.getAnnotations(canvasId);
    if (cachedAnnotations) {
      setAnnotations(cachedAnnotations);
      setIsLoading(false);
      return;
    }

    // Check if there's already a pending request for this canvas
    const existingPromise = pendingRequestRef.current.get(canvasId);
    if (existingPromise) {
      existingPromise
        .then((result) => {
          if (!cancelled && isMountedRef.current) {
            setAnnotations(result);
            setIsLoading(false);
          }
        })
        .catch((error) => {
          console.error('Pending request failed:', error);
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        });
      return;
    }

    if (isMountedRef.current) {
      setIsLoading(true);
    }

    // Create new request promise
    const requestPromise = loadAnnotations(canvasId);
    pendingRequestRef.current.set(canvasId, requestPromise);

    requestPromise
      .then((allAnnotations) => {
        if (cancelled || !isMountedRef.current) return;

        // Store in centralized cache
        cacheManager.setAnnotations(canvasId, allAnnotations);

        setAnnotations(allAnnotations);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error loading annotations:', error);
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      })
      .finally(() => {
        pendingRequestRef.current.delete(canvasId);
      });

    return () => {
      cancelled = true;
    };
  }, [canvasId]);

  // Separate async function for loading annotations
  const loadAnnotations = useCallback(
    async (targetCanvasId: string): Promise<Annotation[]> => {
      try {
        // Parallel loading strategy
        const [externalAnnotations, localAnnotations] =
          await Promise.allSettled([
            fetchAllExternalAnnotations(targetCanvasId),
            fetchLocalAnnotations(targetCanvasId),
          ]);

        let allAnnotations: Annotation[] = [];

        // Merge external annotations
        if (externalAnnotations.status === 'fulfilled') {
          allAnnotations.push(...externalAnnotations.value);
        } else {
          console.error(
            'External annotations failed:',
            externalAnnotations.reason,
          );
        }

        // Merge local annotations
        if (localAnnotations.status === 'fulfilled') {
          allAnnotations.push(...localAnnotations.value);
        } else {
          console.warn('Local annotations failed:', localAnnotations.reason);
        }

        return allAnnotations;
      } catch (error) {
        console.error('Error in loadAnnotations:', error);
        throw error;
      }
    },
    [],
  );

  // Optimized parallel fetching for external annotations
  async function fetchAllExternalAnnotations(
    targetCanvasId: string,
  ): Promise<Annotation[]> {
    const MAX_PARALLEL_REQUESTS = 3;
    const allAnnotations: Annotation[] = [];

    // First request to get total pages
    const firstBatch = await fetchAnnotations({
      targetCanvasId,
      page: 0,
    });

    allAnnotations.push(...firstBatch.items);

    if (!firstBatch.hasMore) {
      return allAnnotations;
    }

    // Estimate total pages and fetch in parallel batches
    const promises: Promise<any>[] = [];
    let page = 1;

    // Fetch multiple pages in parallel (but limit concurrency)
    while (page <= MAX_PARALLEL_REQUESTS) {
      promises.push(
        fetchAnnotations({
          targetCanvasId,
          page,
        }).catch((err) => {
          console.warn(`Failed to fetch page ${page}:`, err);
          return { items: [], hasMore: false };
        }),
      );
      page++;
    }

    const results = await Promise.all(promises);

    for (const result of results) {
      allAnnotations.push(...result.items);

      // If any page has no more items, we've reached the end
      if (!result.hasMore) {
        break;
      }
    }

    return allAnnotations;
  }

  async function fetchLocalAnnotations(
    canvasId: string,
  ): Promise<Annotation[]> {
    try {
      const localResponse = await fetch('/api/annotations/local');
      if (!localResponse.ok) {
        throw new Error(`Local API error: ${localResponse.status}`);
      }

      const { annotations: localAnnotations } = await localResponse.json();

      if (!Array.isArray(localAnnotations)) {
        return [];
      }

      return localAnnotations.filter((annotation: any) => {
        const targetSource =
          annotation.target?.source?.id || annotation.target?.source;
        return targetSource === canvasId;
      });
    } catch (error) {
      // Local annotations are optional, don't fail the entire load
      console.warn('Local annotations unavailable:', error);
      return [];
    }
  }

  // Manual cache invalidation
  const invalidateCache = useCallback((targetCanvasId?: string) => {
    cacheManager.invalidateAnnotationCache(targetCanvasId);
  }, []);

  return {
    annotations,
    isLoading,
    invalidateCache,
    refetch: () => {
      invalidateCache(canvasId);
      // Trigger a re-render to start fresh fetch
      setAnnotations([]);
    },
  };
}
