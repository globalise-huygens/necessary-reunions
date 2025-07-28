import { LinkingAnnotation } from '@/lib/types';
import { useCallback, useEffect, useState } from 'react';

// Simple in-memory cache for linking annotations
const linkingCache = new Map<
  string,
  { data: LinkingAnnotation[]; timestamp: number }
>();
const CACHE_DURATION = 30000; // 30 seconds

export function useLinkingAnnotations(canvasId: string) {
  const [linkingAnnotations, setLinkingAnnotations] = useState<
    LinkingAnnotation[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLinkingAnnotations = useCallback(async () => {
    if (!canvasId) {
      setLinkingAnnotations([]);
      setIsLoading(false);
      return;
    }

    // Check cache first
    const cached = linkingCache.get(canvasId);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      setLinkingAnnotations(cached.data);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const url = `/api/annotations/linking?canvasId=${encodeURIComponent(
        canvasId,
      )}`;

      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        const annotations = data.annotations || [];

        // Update cache
        linkingCache.set(canvasId, { data: annotations, timestamp: now });

        setLinkingAnnotations(annotations);
      } else {
        setLinkingAnnotations([]);
      }
    } catch (error) {
      console.error('Error fetching linking annotations:', error);
      setLinkingAnnotations([]);
    } finally {
      setIsLoading(false);
    }
  }, [canvasId]);

  useEffect(() => {
    fetchLinkingAnnotations();
  }, [fetchLinkingAnnotations]);

  const createLinkingAnnotation = useCallback(
    async (linkingAnnotation: LinkingAnnotation) => {
      try {
        // Optimistic update
        const optimisticAnnotation = {
          ...linkingAnnotation,
          id: linkingAnnotation.id || `temp-${Date.now()}`,
        };

        setLinkingAnnotations((prev) => [...prev, optimisticAnnotation]);

        const response = await fetch('/api/annotations/linking', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(linkingAnnotation),
        });

        if (!response.ok) {
          // Revert optimistic update on failure
          setLinkingAnnotations((prev) =>
            prev.filter((la) => la.id !== optimisticAnnotation.id),
          );

          const errorText = await response.text();
          if (response.status === 409) {
            try {
              const errorData = JSON.parse(errorText);
              throw new Error(
                errorData.error || 'Annotation already has linking data',
              );
            } catch (parseError) {
              throw new Error('One or more annotations are already linked');
            }
          }
          throw new Error(
            `Failed to create linking annotation: ${response.status}`,
          );
        }

        const created = await response.json();

        // Update with actual created annotation
        setLinkingAnnotations((prev) =>
          prev.map((la) => (la.id === optimisticAnnotation.id ? created : la)),
        );

        // Invalidate cache
        linkingCache.delete(canvasId);

        return created;
      } catch (error) {
        console.error('Error creating linking annotation:', error);
        throw error;
      }
    },
    [canvasId],
  );

  const updateLinkingAnnotation = useCallback(
    async (linkingAnnotation: LinkingAnnotation) => {
      try {
        // Optimistic update
        setLinkingAnnotations((prev) =>
          prev.map((la) =>
            la.id === linkingAnnotation.id ? linkingAnnotation : la,
          ),
        );

        const response = await fetch(
          `/api/annotations/linking/${encodeURIComponent(
            linkingAnnotation.id,
          )}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(linkingAnnotation),
          },
        );

        if (!response.ok) {
          // Revert optimistic update on failure
          await fetchLinkingAnnotations();

          const errorText = await response.text();
          if (response.status === 409) {
            try {
              const errorData = JSON.parse(errorText);
              throw new Error(
                errorData.error || 'Annotation already has linking data',
              );
            } catch (parseError) {
              throw new Error('One or more annotations are already linked');
            }
          }
          throw new Error(
            `Failed to update linking annotation: ${response.status}`,
          );
        }

        const updated = await response.json();

        // Update with actual response
        setLinkingAnnotations((prev) =>
          prev.map((la) => (la.id === updated.id ? updated : la)),
        );

        // Invalidate cache
        linkingCache.delete(canvasId);

        return updated;
      } catch (error) {
        console.error('Error updating linking annotation:', error);
        throw error;
      }
    },
    [canvasId, fetchLinkingAnnotations],
  );

  const deleteLinkingAnnotation = useCallback(
    async (linkingAnnotationId: string) => {
      try {
        // Optimistic update
        const originalAnnotations = linkingAnnotations;
        setLinkingAnnotations((prev) =>
          prev.filter((la) => la.id !== linkingAnnotationId),
        );

        const response = await fetch(
          `/api/annotations/linking/${encodeURIComponent(linkingAnnotationId)}`,
          {
            method: 'DELETE',
          },
        );

        if (!response.ok) {
          // Revert optimistic update on failure
          setLinkingAnnotations(originalAnnotations);
          throw new Error(
            `Failed to delete linking annotation: ${response.status}`,
          );
        }

        // Invalidate cache
        linkingCache.delete(canvasId);
      } catch (error) {
        console.error('Error deleting linking annotation:', error);
        throw error;
      }
    },
    [linkingAnnotations, canvasId],
  );

  const getLinkingAnnotationForTarget = useCallback(
    (annotationId: string): LinkingAnnotation | null => {
      return (
        linkingAnnotations.find((la) => la.target.includes(annotationId)) ||
        null
      );
    },
    [linkingAnnotations],
  );

  const getLinkedAnnotations = useCallback(
    (annotationId: string): string[] => {
      const linkingAnnotation = getLinkingAnnotationForTarget(annotationId);
      if (!linkingAnnotation) return [];

      return linkingAnnotation.target.filter((id) => id !== annotationId);
    },
    [getLinkingAnnotationForTarget],
  );

  const isAnnotationLinked = useCallback(
    (annotationId: string): boolean => {
      return linkingAnnotations.some((la) => la.target.includes(annotationId));
    },
    [linkingAnnotations],
  );

  return {
    linkingAnnotations,
    isLoading,
    createLinkingAnnotation,
    updateLinkingAnnotation,
    deleteLinkingAnnotation,
    getLinkingAnnotationForTarget,
    getLinkedAnnotations,
    isAnnotationLinked,
    refetch: fetchLinkingAnnotations,
  };
}
