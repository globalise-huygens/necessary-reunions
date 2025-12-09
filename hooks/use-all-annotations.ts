/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { useEffect, useRef, useState } from 'react';
import type { Annotation } from '../lib/types';
import { fetchAnnotations } from '../lib/viewer/annoRepo';

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

      console.log('[SVG Debug] useAllAnnotations: Starting fetch', {
        canvasIdFull: canvasId,
        canvasIdLength: canvasId.length,
      });

      const all: Annotation[] = [];
      let page = 0;
      let more = true;

      while (more && !cancelled) {
        try {
          const { items, hasMore } = await fetchAnnotations({
            targetCanvasId: canvasId,
            page,
          });
          console.log('[SVG Debug] useAllAnnotations: Fetched page', {
            page,
            itemsCount: items.length,
            hasMore,
          });
          all.push(...items);
          more = hasMore;
          page++;
        } catch (error) {
          console.error('[SVG Debug] useAllAnnotations: Fetch error', error);
          break;
        }
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
        console.log('[SVG Debug] useAllAnnotations: Complete', {
          totalAnnotations: all.length,
          externalPages: page,
          canvasIdFull: canvasId,
        });
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
