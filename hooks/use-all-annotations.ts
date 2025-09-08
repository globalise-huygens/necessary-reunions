import type { Annotation } from '@/lib/types';
import { fetchAnnotations } from '@/lib/viewer/annoRepo';
import { useEffect, useRef, useState } from 'react';

export function useAllAnnotations(canvasId: string) {
  console.log('[useAllAnnotations] Function called with canvasId:', canvasId);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  console.log(
    '[useAllAnnotations] State initialized, annotations:',
    annotations.length,
    'isLoading:',
    isLoading,
  );

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    console.log(
      '[useAllAnnotations] Real useEffect running with canvasId:',
      canvasId,
    );
    let cancelled = false;

    if (!canvasId) {
      console.log('[useAllAnnotations] No canvasId, skipping');
      if (isMountedRef.current) {
        setAnnotations([]);
        setIsLoading(false);
      }
      return;
    }

    console.log('[useAllAnnotations] Starting fetch for canvasId:', canvasId);
    if (isMountedRef.current) {
      setIsLoading(true);
    }

    (async () => {
      console.log('[useAllAnnotations] Starting async function');
      let all: Annotation[] = [];
      let page = 0;
      let more = true;

      // Try to fetch from external annotation repository
      console.log(
        '[useAllAnnotations] Starting external annotation fetch loop',
      );
      while (more && !cancelled && isMountedRef.current) {
        console.log(
          '[useAllAnnotations] Inside while loop, starting iteration',
          page,
        );
        try {
          console.log(
            '[useAllAnnotations] Fetching page',
            page,
            'for canvasId:',
            canvasId,
          );
          const { items, hasMore } = await fetchAnnotations({
            targetCanvasId: canvasId,
            page,
          });
          console.log(
            `[useAllAnnotations] External annotations fetched: ${items.length} items, hasMore: ${hasMore}`,
          );
          all.push(...items);
          more = hasMore;
          page++;
        } catch (err) {
          console.error(
            '[useAllAnnotations] External annotation repository error:',
            err,
          );
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
              console.log(
                `[useAllAnnotations] Loaded ${canvasLocalAnnotations.length} local annotations for canvas:`,
                canvasId,
              );
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
        console.log(
          `[useAllAnnotations] Total annotations loaded: ${all.length}`,
        );
        console.log(
          '[useAllAnnotations] Setting annotations in state:',
          all.length > 0 ? 'with data' : 'empty array',
        );
        setAnnotations(all);
        setIsLoading(false);
        console.log(
          '[useAllAnnotations] isLoading set to false, annotations state updated',
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canvasId]);

  console.log('[useAllAnnotations] Returning:', {
    annotations: annotations.length,
    isLoading,
  });

  return { annotations, isLoading };
}
