import { LinkingAnnotation } from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';

const bulkLinkingCache = new Map<
  string,
  {
    data: LinkingAnnotation[];
    iconStates: Record<
      string,
      { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
    >;
    timestamp: number;
  }
>();
const CACHE_DURATION = 60000; // Increased to 60 seconds for bulk data
const pendingRequests = new Map<string, Promise<any>>();

export const invalidateBulkLinkingCache = (targetCanvasId?: string) => {
  if (targetCanvasId) {
    bulkLinkingCache.delete(targetCanvasId);
  } else {
    bulkLinkingCache.clear();
  }
};

export function useBulkLinkingAnnotations(targetCanvasId: string) {
  const [linkingAnnotations, setLinkingAnnotations] = useState<
    LinkingAnnotation[]
  >([]);
  const [iconStates, setIconStates] = useState<
    Record<string, { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchBulkLinkingAnnotations = async () => {
      if (!targetCanvasId) {
        if (isMountedRef.current) {
          setLinkingAnnotations([]);
          setIconStates({});
          setIsLoading(false);
        }
        return;
      }

      const cached = bulkLinkingCache.get(targetCanvasId);
      const now = Date.now();

      if (cached && now - cached.timestamp < CACHE_DURATION) {
        if (isMountedRef.current) {
          setLinkingAnnotations(cached.data);
          setIconStates(cached.iconStates);
          setIsLoading(false);
        }
        return;
      }

      const requestKey = `bulk-fetch-${targetCanvasId}`;
      if (pendingRequests.has(requestKey)) {
        try {
          await pendingRequests.get(requestKey);
          return;
        } catch (error) {}
      }

      if (isMountedRef.current) {
        setIsLoading(true);
      }

      const fetchPromise = (async () => {
        try {
          const url = `/api/annotations/linking-bulk?targetCanvasId=${encodeURIComponent(
            targetCanvasId,
          )}`;
          const response = await fetch(url);

          if (response.ok) {
            const data = await response.json();
            const annotations = data.annotations || [];
            const states = data.iconStates || {};

            bulkLinkingCache.set(targetCanvasId, {
              data: annotations,
              iconStates: states,
              timestamp: now,
            });

            if (isMountedRef.current) {
              setLinkingAnnotations(annotations);
              setIconStates(states);
            }
          } else {
            if (isMountedRef.current) {
              setLinkingAnnotations([]);
              setIconStates({});
            }
          }
        } catch (error) {
          if (isMountedRef.current) {
            setLinkingAnnotations([]);
            setIconStates({});
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
    };

    fetchBulkLinkingAnnotations();
  }, [targetCanvasId, refreshTrigger]);

  const getLinkingAnnotationForTarget = useCallback(
    (targetId: string): LinkingAnnotation | null => {
      return (
        linkingAnnotations.find((la) =>
          Array.isArray(la.target)
            ? la.target.includes(targetId)
            : la.target === targetId,
        ) || null
      );
    },
    [linkingAnnotations],
  );

  const isAnnotationLinked = useCallback(
    (annotationId: string): boolean => {
      return !!getLinkingAnnotationForTarget(annotationId);
    },
    [getLinkingAnnotationForTarget],
  );

  const refetch = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const forceRefresh = useCallback(() => {
    invalidateBulkLinkingCache(targetCanvasId);
    setRefreshTrigger((prev) => prev + 1);
  }, [targetCanvasId]);

  const invalidateCache = useCallback(() => {
    invalidateBulkLinkingCache(targetCanvasId);
  }, [targetCanvasId]);

  return {
    linkingAnnotations,
    iconStates,
    isLoading,
    getLinkingAnnotationForTarget,
    isAnnotationLinked,
    refetch,
    forceRefresh: forceRefresh,
    invalidateCache,
  };
}
