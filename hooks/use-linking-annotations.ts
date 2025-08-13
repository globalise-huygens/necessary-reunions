import { LinkingAnnotation } from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';

const linkingCache = new Map<
  string,
  { data: LinkingAnnotation[]; timestamp: number }
>();
const CACHE_DURATION = 5000;

const pendingRequests = new Map<string, Promise<any>>();

export const invalidateLinkingCache = (canvasId?: string) => {
  if (canvasId) {
    linkingCache.delete(canvasId);
  } else {
    linkingCache.clear();
  }
};

export function useLinkingAnnotations(canvasId: string) {
  const [linkingAnnotations, setLinkingAnnotations] = useState<
    LinkingAnnotation[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchLinkingAnnotations = useCallback(async () => {
    if (!canvasId) {
      if (isMountedRef.current) {
        setLinkingAnnotations([]);
        setIsLoading(false);
      }
      return;
    }

    const cached = linkingCache.get(canvasId);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      if (isMountedRef.current) {
        setLinkingAnnotations(cached.data);
        setIsLoading(false);
      }
      return;
    }
    const requestKey = `fetch-${canvasId}`;
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
        const url = `/api/annotations/linking?canvasId=${encodeURIComponent(
          canvasId,
        )}`;

        const response = await fetch(url);

        if (response.ok) {
          const data = await response.json();
          const annotations = data.annotations || [];

          linkingCache.set(canvasId, { data: annotations, timestamp: now });

          if (isMountedRef.current) {
            setLinkingAnnotations(annotations);
          }
        } else {
          if (isMountedRef.current) {
            setLinkingAnnotations([]);
          }
        }
      } catch (error) {
        if (isMountedRef.current) {
          setLinkingAnnotations([]);
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
  }, [canvasId]);

  useEffect(() => {
    fetchLinkingAnnotations();
  }, [fetchLinkingAnnotations]);

  const createLinkingAnnotation = useCallback(
    async (linkingAnnotation: LinkingAnnotation) => {
      console.group('🔗 CREATE LINKING ANNOTATION API CALL');
      console.log(
        '📝 Payload being sent:',
        JSON.stringify(linkingAnnotation, null, 2),
      );

      try {
        const optimisticAnnotation = {
          ...linkingAnnotation,
          id: linkingAnnotation.id || `temp-${Date.now()}`,
        };

        console.log('⚡ Optimistic annotation ID:', optimisticAnnotation.id);

        if (isMountedRef.current) {
          setLinkingAnnotations((prev) => [...prev, optimisticAnnotation]);
          console.log('✅ Added optimistic annotation to state');
        }

        linkingCache.delete(canvasId);
        console.log('🗑️ Cleared linking cache for canvas:', canvasId);

        const response = await fetch('/api/annotations/linking', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(linkingAnnotation),
        });

        console.log(
          '📡 API response status:',
          response.status,
          response.statusText,
        );

        if (!response.ok) {
          console.error('❌ API call failed');
          if (isMountedRef.current) {
            setLinkingAnnotations((prev) =>
              prev.filter((la) => la.id !== optimisticAnnotation.id),
            );
            console.log('🔄 Removed optimistic annotation from state');
          }

          let errorMessage = `Failed to create linking annotation: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
            console.error('📋 Error response data:', errorData);
          } catch (parseError) {
            errorMessage = `Failed to create linking annotation: ${response.status} ${response.statusText}`;
            console.error('❌ Failed to parse error response:', parseError);
          }

          if (response.status === 409) {
            console.error(
              '🚫 Conflict: One or more annotations are already linked',
            );
            throw new Error('One or more annotations are already linked');
          }
          console.error('❌ Throwing error:', errorMessage);
          throw new Error(errorMessage);
        }

        const created = await response.json();
        console.log('✅ Successfully created:', created.id);
        console.groupEnd();

        if (isMountedRef.current) {
          setLinkingAnnotations((prev) =>
            prev.map((la) =>
              la.id === optimisticAnnotation.id ? created : la,
            ),
          );
        }

        const cached = linkingCache.get(canvasId);
        const updatedData = cached
          ? [
              ...cached.data.filter((la) => la.id !== optimisticAnnotation.id),
              created,
            ]
          : [created];
        linkingCache.set(canvasId, {
          data: updatedData,
          timestamp: Date.now(),
        });

        return created;
      } catch (error) {
        console.error('❌ CREATE LINKING ANNOTATION FAILED:', error);
        console.log('🚨 Error details:', {
          message: (error as Error).message,
          stack: (error as Error).stack,
          payloadId: linkingAnnotation.id,
          targetCount: linkingAnnotation.target?.length,
          bodyCount: linkingAnnotation.body?.length,
        });
        console.groupEnd();
        throw error;
      }
    },
    [canvasId],
  );

  const updateLinkingAnnotation = useCallback(
    async (linkingAnnotation: LinkingAnnotation) => {
      console.group('🔗 UPDATE LINKING ANNOTATION API CALL');
      console.log(
        '📝 Payload being sent:',
        JSON.stringify(linkingAnnotation, null, 2),
      );
      console.log('🆔 Updating annotation ID:', linkingAnnotation.id);

      try {
        const originalAnnotations = linkingAnnotations;

        if (isMountedRef.current) {
          setLinkingAnnotations((prev) =>
            prev.map((la) =>
              la.id === linkingAnnotation.id ? linkingAnnotation : la,
            ),
          );
          console.log('✅ Updated optimistic annotation in state');
        }

        linkingCache.delete(canvasId);

        const annotationId = linkingAnnotation.id;
        const encodedId = encodeURIComponent(encodeURIComponent(annotationId));

        const response = await fetch(`/api/annotations/linking/${encodedId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(linkingAnnotation),
        });

        if (!response.ok) {
          if (isMountedRef.current) {
            setLinkingAnnotations(originalAnnotations);
          }

          let errorMessage = `Failed to update linking annotation: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            try {
              const errorText = await response.text();
              errorMessage = `Failed to update linking annotation: ${response.status} ${response.statusText}`;
            } catch (textError) {
              errorMessage = `Failed to update linking annotation: ${response.status} ${response.statusText}`;
            }
          }

          if (response.status === 409) {
            throw new Error('One or more annotations are already linked');
          }
          throw new Error(errorMessage);
        }

        const updated = await response.json();

        if (isMountedRef.current) {
          setLinkingAnnotations((prev) =>
            prev.map((la) => (la.id === updated.id ? updated : la)),
          );
        }

        const cached = linkingCache.get(canvasId);
        if (cached) {
          const updatedData = cached.data.map((la: LinkingAnnotation) =>
            la.id === updated.id ? updated : la,
          );
          linkingCache.set(canvasId, {
            data: updatedData,
            timestamp: Date.now(),
          });
        } else {
          linkingCache.set(canvasId, {
            data: linkingAnnotations.map((la: LinkingAnnotation) =>
              la.id === updated.id ? updated : la,
            ),
            timestamp: Date.now(),
          });
        }

        return updated;
      } catch (error) {
        throw error;
      }
    },
    [linkingAnnotations, canvasId],
  );

  const deleteLinkingAnnotation = useCallback(
    async (linkingAnnotationId: string) => {
      try {
        const originalAnnotations = linkingAnnotations;

        if (isMountedRef.current) {
          setLinkingAnnotations((prev) =>
            prev.filter((la) => la.id !== linkingAnnotationId),
          );
        }

        linkingCache.delete(canvasId);

        const encodedId = encodeURIComponent(
          encodeURIComponent(linkingAnnotationId),
        );
        const response = await fetch(`/api/annotations/linking/${encodedId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          if (isMountedRef.current) {
            setLinkingAnnotations(originalAnnotations);
          }

          let errorMessage = `Failed to delete linking annotation: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            errorMessage = `Failed to delete linking annotation: ${response.status} ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const cached = linkingCache.get(canvasId);
        if (cached) {
          const updatedData = cached.data.filter(
            (la: LinkingAnnotation) => la.id !== linkingAnnotationId,
          );
          linkingCache.set(canvasId, {
            data: updatedData,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
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
    clearCache: () => linkingCache.clear(),
    invalidateCache: () => invalidateLinkingCache(canvasId),
  };
}
