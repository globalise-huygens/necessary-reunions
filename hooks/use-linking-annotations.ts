import { LinkingAnnotation } from '@/lib/types';
import { useCallback, useEffect, useState } from 'react';

export function useLinkingAnnotations(canvasId: string) {
  const [linkingAnnotations, setLinkingAnnotations] = useState<
    LinkingAnnotation[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLinkingAnnotations = useCallback(async () => {
    if (!canvasId) {
      console.log('useLinkingAnnotations: No canvasId provided');
      setLinkingAnnotations([]);
      setIsLoading(false);
      return;
    }

    console.log('useLinkingAnnotations: Fetching for canvasId:', canvasId);
    setIsLoading(true);

    try {
      const url = `/api/annotations/linking?canvasId=${encodeURIComponent(
        canvasId,
      )}`;
      console.log('useLinkingAnnotations: Fetching from URL:', url);

      const response = await fetch(url);
      console.log('useLinkingAnnotations: Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('useLinkingAnnotations: Received data:', data);
        setLinkingAnnotations(data.annotations || []);
        console.log(
          'useLinkingAnnotations: Set annotations count:',
          (data.annotations || []).length,
        );
      } else {
        console.error('Failed to fetch linking annotations:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
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
      console.log('Hook: Creating linking annotation:', linkingAnnotation);
      try {
        const response = await fetch('/api/annotations/linking', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(linkingAnnotation),
        });

        console.log('API Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error response:', errorText);

          // Handle conflict errors specifically
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
        console.log('Successfully created annotation:', created);
        setLinkingAnnotations((prev) => [...prev, created]);
        return created;
      } catch (error) {
        console.error('Error creating linking annotation:', error);
        throw error;
      }
    },
    [],
  );

  const updateLinkingAnnotation = useCallback(
    async (linkingAnnotation: LinkingAnnotation) => {
      try {
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
        setLinkingAnnotations((prev) =>
          prev.map((la) => (la.id === updated.id ? updated : la)),
        );
        return updated;
      } catch (error) {
        console.error('Error updating linking annotation:', error);
        throw error;
      }
    },
    [],
  );

  const deleteLinkingAnnotation = useCallback(
    async (linkingAnnotationId: string) => {
      try {
        const response = await fetch(
          `/api/annotations/linking/${encodeURIComponent(linkingAnnotationId)}`,
          {
            method: 'DELETE',
          },
        );

        if (!response.ok) {
          throw new Error(
            `Failed to delete linking annotation: ${response.status}`,
          );
        }

        setLinkingAnnotations((prev) =>
          prev.filter((la) => la.id !== linkingAnnotationId),
        );
      } catch (error) {
        console.error('Error deleting linking annotation:', error);
        throw error;
      }
    },
    [],
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
