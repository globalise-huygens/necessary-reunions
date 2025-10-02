import { LinkingAnnotation } from '@/lib/types';
import { useCallback, useEffect, useState } from 'react';
import { STATIC_LINKING_ANNOTATIONS, shouldUseStaticData } from '@/lib/static-data';

export function useStaticBulkLinkingAnnotations(targetCanvasId: string) {
  const [linkingAnnotations, setLinkingAnnotations] = useState<LinkingAnnotation[]>([]);
  const [iconStates, setIconStates] = useState<Record<string, { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetCanvasId) return;

    setIsLoading(true);
    setError(null);

    // Simulate loading delay for consistent UX
    setTimeout(() => {
      setLinkingAnnotations(STATIC_LINKING_ANNOTATIONS);
      setIconStates({});
      setIsLoading(false);
      console.log('[LINKING] Static linking annotations loaded');
    }, 500);
  }, [targetCanvasId]);

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
    // No-op for static data
  }, []);

  const forceRefresh = useCallback(() => {
    // No-op for static data
  }, []);

  const invalidateCache = useCallback(() => {
    // No-op for static data
  }, []);

  return {
    linkingAnnotations,
    iconStates,
    isLoading,
    error,
    retryCount: 0,
    isPermanentFailure: false,
    getLinkingAnnotationForTarget,
    isAnnotationLinked,
    refetch,
    forceRefresh,
    invalidateCache,
  };
}