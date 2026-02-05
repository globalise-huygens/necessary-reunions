/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */

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

      const all: Annotation[] = [];
      let page = 0;
      let more = true;
      let consecutiveFailures = 0;
      const MAX_FAILURES = 3;

      while (more && !cancelled && consecutiveFailures < MAX_FAILURES) {
        try {
          // Primary: Direct browser→AnnoRepo (no Netlify timeout)
          const { items, hasMore } = await fetchAnnotationsDirectly({
            targetCanvasId: canvasId,
            page,
          });
          all.push(...items);
          more = hasMore;
          page++;
          consecutiveFailures = 0;
        } catch {
          // Fallback: Try API route (may work in some environments)
          try {
            const { items, hasMore } = await fetchAnnotations({
              targetCanvasId: canvasId,
              page,
            });
            all.push(...items);
            more = hasMore;
            page++;
            consecutiveFailures = 0;
          } catch {
            consecutiveFailures++;
            page++;
          }
        }
      }

      // Development: Log summary only
      if (process.env.NODE_ENV === 'development' && all.length > 0) {
        console.log(`[Annotations] Loaded ${all.length} for canvas`);
      }

      if (!cancelled) {
        try {
          const localResponse = await fetch('/api/annotations/local');
          if (localResponse.ok) {
            const { annotations: localAnnotations } =
              await localResponse.json();
            if (Array.isArray(localAnnotations)) {
              const canvasLocalAnnotations = localAnnotations.filter(
                (annotation: any) => {
                  const targetSource =
                    annotation.target?.source?.id || annotation.target?.source;
                  return targetSource === canvasId;
                },
              );
              all.push(...canvasLocalAnnotations);
            }
          }
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
