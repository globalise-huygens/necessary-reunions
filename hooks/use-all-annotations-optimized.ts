import type { Annotation } from '@/lib/types';
import { fetchAnnotations } from '@/lib/viewer/annoRepo';
import { useEffect, useRef, useState } from 'react';

// Optimized version with parallel loading and caching
export function useAllAnnotationsOptimized(canvasId: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isMountedRef = useRef(true);

  // Cache annotations per canvas for 5 minutes
  const cacheRef = useRef<
    Map<
      string,
      {
        annotations: Annotation[];
        timestamp: number;
        isLoading: boolean;
      }
    >
  >(new Map());

  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

    // Check cache first
    const cached = cacheRef.current.get(canvasId);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      if (cached.isLoading) {
        // Another request is already in progress
        return;
      }
      setAnnotations(cached.annotations);
      setIsLoading(false);
      return;
    }

    // Mark as loading in cache to prevent duplicate requests
    cacheRef.current.set(canvasId, {
      annotations: cached?.annotations || [],
      timestamp: now,
      isLoading: true,
    });

    if (isMountedRef.current) {
      setIsLoading(true);
    }

    (async () => {
      try {
        // Parallel loading strategy
        const [externalAnnotations, localAnnotations] =
          await Promise.allSettled([
            fetchAllExternalAnnotations(canvasId),
            fetchLocalAnnotations(canvasId),
          ]);

        if (cancelled || !isMountedRef.current) return;

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

        // Update cache and state
        cacheRef.current.set(canvasId, {
          annotations: allAnnotations,
          timestamp: now,
          isLoading: false,
        });

        if (isMountedRef.current) {
          setAnnotations(allAnnotations);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading annotations:', error);

        // Clear loading state in cache
        const current = cacheRef.current.get(canvasId);
        if (current) {
          cacheRef.current.set(canvasId, {
            ...current,
            isLoading: false,
          });
        }

        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canvasId]);

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
  const invalidateCache = (targetCanvasId?: string) => {
    if (targetCanvasId) {
      cacheRef.current.delete(targetCanvasId);
    } else {
      cacheRef.current.clear();
    }
  };

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
