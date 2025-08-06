import { fetchAnnotations } from '@/lib/annoRepo';
import type { Annotation } from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useAllAnnotations(canvasId: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
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
          break;
        }
      }

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
          }
        } catch (err) {}
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
