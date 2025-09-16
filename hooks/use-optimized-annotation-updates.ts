import type { Annotation } from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';

// Optimized annotation update hook with debouncing and optimistic updates
export function useOptimizedAnnotationUpdates() {
  const [pendingUpdates, setPendingUpdates] = useState<
    Map<
      string,
      {
        annotation: Annotation;
        updateValue: string;
        timestamp: number;
        promise?: Promise<void>;
      }
    >
  >(new Map());

  const debounceTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const DEBOUNCE_DELAY = 1000; // 1 second debounce

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      debounceTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
      debounceTimeoutRef.current.clear();
    };
  }, []);

  const updateAnnotationOptimistic = useCallback(
    async (
      annotation: Annotation,
      newValue: string,
      onOptimisticUpdate?: (annotation: Annotation, newValue: string) => void,
      onSuccess?: (annotation: Annotation) => void,
      onError?: (annotation: Annotation, error: any) => void,
    ) => {
      const annotationId = annotation.id;

      // Apply optimistic update immediately
      if (onOptimisticUpdate) {
        onOptimisticUpdate(annotation, newValue);
      }

      // Clear any existing timeout for this annotation
      const existingTimeout = debounceTimeoutRef.current.get(annotationId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Store the pending update
      const updateData = {
        annotation,
        updateValue: newValue,
        timestamp: Date.now(),
      };

      setPendingUpdates((prev) => new Map(prev).set(annotationId, updateData));

      // Create debounced update
      const updateTimeout = setTimeout(async () => {
        try {
          const currentUpdate = pendingUpdates.get(annotationId);
          if (
            !currentUpdate ||
            currentUpdate.timestamp !== updateData.timestamp
          ) {
            // A newer update has superseded this one
            return;
          }

          // Create updated annotation with new body value
          const updatedAnnotation = createUpdatedAnnotation(
            annotation,
            newValue,
          );

          const response = await fetch(
            `/api/annotations/${encodeURIComponent(annotationId)}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(updatedAnnotation),
            },
          );

          if (!response.ok) {
            throw new Error(`Update failed: ${response.status}`);
          }

          const savedAnnotation = await response.json();

          // Remove from pending updates
          setPendingUpdates((prev) => {
            const newMap = new Map(prev);
            newMap.delete(annotationId);
            return newMap;
          });

          debounceTimeoutRef.current.delete(annotationId);

          if (onSuccess) {
            onSuccess(savedAnnotation);
          }
        } catch (error) {
          console.error('Annotation update failed:', error);

          // Remove from pending updates
          setPendingUpdates((prev) => {
            const newMap = new Map(prev);
            newMap.delete(annotationId);
            return newMap;
          });

          debounceTimeoutRef.current.delete(annotationId);

          if (onError) {
            onError(annotation, error);
          }
        }
      }, DEBOUNCE_DELAY);

      debounceTimeoutRef.current.set(annotationId, updateTimeout);
    },
    [pendingUpdates],
  );

  // Force flush all pending updates immediately
  const flushPendingUpdates = useCallback(async () => {
    const currentPending = Array.from(pendingUpdates.entries());

    // Clear all timeouts and trigger immediate updates
    for (const [annotationId, updateData] of currentPending) {
      const timeout = debounceTimeoutRef.current.get(annotationId);
      if (timeout) {
        clearTimeout(timeout);
        debounceTimeoutRef.current.delete(annotationId);

        // Trigger immediate update
        try {
          const updatedAnnotation = createUpdatedAnnotation(
            updateData.annotation,
            updateData.updateValue,
          );

          await fetch(`/api/annotations/${encodeURIComponent(annotationId)}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedAnnotation),
          });
        } catch (error) {
          console.error(
            'Failed to flush update for annotation:',
            annotationId,
            error,
          );
        }
      }
    }

    setPendingUpdates(new Map());
  }, [pendingUpdates]);

  const hasPendingUpdates = pendingUpdates.size > 0;

  return {
    updateAnnotationOptimistic,
    flushPendingUpdates,
    hasPendingUpdates,
    pendingCount: pendingUpdates.size,
  };
}

function createUpdatedAnnotation(
  annotation: Annotation,
  newValue: string,
): Annotation {
  if (!annotation.body) {
    return annotation;
  }

  const bodies = Array.isArray(annotation.body)
    ? annotation.body
    : [annotation.body];

  // Update the textual body
  const updatedBodies = bodies.map((body: any) => {
    if (body.type === 'TextualBody' && !body.generator) {
      return {
        ...body,
        value: newValue.trim(),
        modified: new Date().toISOString(),
      };
    }
    return body;
  });

  return {
    ...annotation,
    body: Array.isArray(annotation.body) ? updatedBodies : updatedBodies[0],
    modified: new Date().toISOString(),
  };
}
