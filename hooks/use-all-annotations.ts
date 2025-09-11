import type { Annotation } from '@/lib/types';
import { fetchAnnotations } from '@/lib/viewer/annoRepo';
import { useEffect, useRef, useState } from 'react';

export function useAllAnnotations(canvasId: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isMountedRef = useRef(true);

  // Only set to false when component actually unmounts
  useEffect(() => {
    isMountedRef.current = true; // Ensure it's true on mount
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

    if (isMountedRef.current) {
      setIsLoading(true);
    }

    (async () => {
      let all: Annotation[] = [];
      let page = 0;
      let more = true;

      // Try to fetch from external annotation repository
      while (more && !cancelled && isMountedRef.current) {
        try {
          const { items, hasMore } = await fetchAnnotations({
            targetCanvasId: canvasId,
            page,
          });
          all.push(...items);
          more = hasMore;
          page++;
        } catch (err) {
          console.error('External annotation repository error:', err);
          break;
        }
      }

      // Try to fetch local annotations
      if (!cancelled && isMountedRef.current) {
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
          } else {
            console.warn(
              '[useAllAnnotations] Local annotations API returned status:',
              localResponse.status,
            );
          }
        } catch (err) {
          console.warn(
            '[useAllAnnotations] Local annotations API unavailable in development mode:',
            err,
          );
        }
      }

      if (!cancelled && isMountedRef.current) {
        setAnnotations(all);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canvasId]);

  return { annotations, isLoading };
}
