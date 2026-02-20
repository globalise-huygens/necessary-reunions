/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable no-loop-func */
/* eslint-disable @typescript-eslint/naming-convention */

import { useEffect, useRef, useState } from 'react';
import type { Annotation } from '../lib/types';
import {
  fetchAnnotations,
  fetchAnnotationsDirectly,
} from '../lib/viewer/annoRepo';

export function useAllAnnotations(canvasId: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!canvasId) {
      return;
    }

    const loadAnnotations = async () => {
      if (cancelled) return;
      setIsLoading(true);

      // Start local annotations fetch immediately in parallel
      const localPromise = fetch('/api/annotations/local')
        .then(async (res) => {
          if (!res.ok) return [];
          const { annotations: localAnnotations } = await res.json();
          if (!Array.isArray(localAnnotations)) return [];
          return localAnnotations.filter((annotation: any) => {
            const targetSource =
              annotation.target?.source?.id || annotation.target?.source;
            return targetSource === canvasId;
          });
        })
        .catch(() => [] as Annotation[]);

      const all: Annotation[] = [];
      let consecutiveFailures = 0;
      const MAX_FAILURES = 3;
      const MAX_CONCURRENT = 4;

      // Fetch first page to determine pagination
      let hasMorePages = true;
      try {
        const { items, hasMore } = await fetchAnnotationsDirectly({
          targetCanvasId: canvasId,
          page: 0,
        });
        all.push(...items);
        hasMorePages = hasMore;
      } catch {
        try {
          const { items, hasMore } = await fetchAnnotations({
            targetCanvasId: canvasId,
            page: 0,
          });
          all.push(...items);
          hasMorePages = hasMore;
        } catch {
          consecutiveFailures++;
        }
      }

      // Fetch remaining pages in parallel batches
      if (hasMorePages && !cancelled && consecutiveFailures < MAX_FAILURES) {
        let nextPage = 1;
        let keepFetching = true;

        while (keepFetching && !cancelled) {
          const pagesToFetch = Array.from(
            { length: MAX_CONCURRENT },
            (_, i) => nextPage + i,
          );
          nextPage += MAX_CONCURRENT;

          const results = await Promise.allSettled(
            pagesToFetch.map(async (page) => {
              try {
                return await fetchAnnotationsDirectly({
                  targetCanvasId: canvasId,
                  page,
                });
              } catch {
                return await fetchAnnotations({
                  targetCanvasId: canvasId,
                  page,
                });
              }
            }),
          );

          let batchHasMore = false;
          let batchFailures = 0;

          for (const result of results) {
            if (result.status === 'fulfilled') {
              all.push(...result.value.items);
              if (result.value.hasMore) batchHasMore = true;
            } else {
              batchFailures++;
            }
          }

          // Stop if no page indicated more results or too many failures
          keepFetching = batchHasMore && batchFailures < MAX_CONCURRENT;
        }
      }

      // Development: Log summary only
      if (process.env.NODE_ENV === 'development' && all.length > 0) {
        console.log(`[Annotations] Loaded ${all.length} for canvas`);
      }

      // Merge local annotations (already fetching in parallel)
      if (!cancelled) {
        try {
          const localAnnotations = await localPromise;
          all.push(...localAnnotations);
        } catch {}
      }

      if (!cancelled) {
        setAnnotations(all);
        setIsLoading(false);
      }
    };

    loadAnnotations().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [canvasId]);

  return { annotations, isLoading };
}
