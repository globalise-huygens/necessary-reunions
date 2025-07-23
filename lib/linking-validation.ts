import { encodeCanvasUri } from './utils';

export interface AnnotationConflict {
  annotationId: string;
  existingLinkingId: string;
  motivation: string;
  conflictType: 'linking' | 'geotagging' | 'point_selection';
}

export interface ValidationResult {
  isValid: boolean;
  conflicts: AnnotationConflict[];
  warnings: string[];
  mergeable?: Array<{
    annotationId: string;
    existingLinkingId: string;
    existingContent: string[];
    canMerge: boolean;
    reason: string;
  }>;
}

/**
 * Validates if annotations can be linked together by checking for existing
 * linking annotations and determining if they can be merged
 */
export async function validateLinkingAnnotations(
  annotationIds: string[],
  excludeLinkingId?: string,
): Promise<ValidationResult> {
  if (annotationIds.length <= 1) {
    return {
      isValid: true,
      conflicts: [],
      warnings: [],
      mergeable: [],
    };
  }

  try {
    const response = await fetch('/api/annotations/validate-linking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        annotationIds,
        excludeLinkingId,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        isValid: data.isValid,
        conflicts: data.conflicts || [],
        warnings: data.warnings || [],
        mergeable: data.mergeable || [],
      };
    } else {
      console.error('Validation request failed:', response.status);
      return {
        isValid: false,
        conflicts: [],
        warnings: ['Failed to validate annotations - server error'],
        mergeable: [],
      };
    }
  } catch (error) {
    console.error('Error validating linking annotations:', error);
    return {
      isValid: false,
      conflicts: [],
      warnings: ['Failed to validate annotations - network error'],
      mergeable: [],
    };
  }
}

/**
 * Gets all linking annotations for a specific annotation ID across all motivations
 */
export async function getLinkingAnnotationsForAnnotation(
  annotationId: string,
  canvasId?: string,
): Promise<{
  linking?: any;
  geotagging?: any;
  pointSelection?: any;
}> {
  const result: any = {};

  try {
    let actualCanvasId = canvasId;
    if (!actualCanvasId && annotationId.includes('#')) {
      actualCanvasId = annotationId.split('#')[0];
    }

    const apiUrl = actualCanvasId
      ? `/api/annotations/linking?canvasId=${encodeURIComponent(
          actualCanvasId,
        )}`
      : `/api/annotations/linking?canvasId=${encodeURIComponent('temp')}`;

    console.log('getLinkingAnnotationsForAnnotation: Using API URL:', apiUrl);
    const response = await fetch(apiUrl);

    if (response.ok) {
      const data = await response.json();
      const linkingAnnotations = data.annotations || [];

      for (const linkingAnnotation of linkingAnnotations) {
        const targets = Array.isArray(linkingAnnotation.target)
          ? linkingAnnotation.target
          : [linkingAnnotation.target];

        if (targets.includes(annotationId)) {
          if (linkingAnnotation.motivation === 'linking') {
            result.linking = linkingAnnotation;
          } else if (linkingAnnotation.motivation === 'geotagging') {
            result.geotagging = linkingAnnotation;
          } else if (linkingAnnotation.motivation === 'point_selection') {
            result.pointSelection = linkingAnnotation;
          }

          if (linkingAnnotation.body && Array.isArray(linkingAnnotation.body)) {
            for (const bodyItem of linkingAnnotation.body) {
              if (bodyItem.purpose === 'geotagging') {
                result.geotagging = linkingAnnotation;
              } else if (
                bodyItem.purpose === 'highlighting' &&
                bodyItem.selector?.type === 'PointSelector'
              ) {
                result.pointSelection = linkingAnnotation;
              }
            }
          } else if (linkingAnnotation.body) {
            const bodyItem = linkingAnnotation.body;
            if (bodyItem.purpose === 'geotagging') {
              result.geotagging = linkingAnnotation;
            } else if (
              bodyItem.purpose === 'highlighting' &&
              bodyItem.selector?.type === 'PointSelector'
            ) {
              result.pointSelection = linkingAnnotation;
            }
          }

          if (
            linkingAnnotation.motivation === 'linking' &&
            linkingAnnotation.body
          ) {
            const bodies = Array.isArray(linkingAnnotation.body)
              ? linkingAnnotation.body
              : [linkingAnnotation.body];

            const hasPointSelector = bodies.some(
              (body: any) =>
                body.purpose === 'highlighting' &&
                body.selector?.type === 'PointSelector',
            );

            if (hasPointSelector) {
              result.pointSelection = linkingAnnotation;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(
      `Error fetching linking annotations for ${annotationId}:`,
      error,
    );
  }

  return result;
}

/**
 * Deletes only the linking relationship without deleting the target annotations
 */
export async function deleteLinkingRelationship(
  linkingAnnotationId: string,
  motivation: 'linking' | 'geotagging' | 'point_selection',
): Promise<void> {
  const response = await fetch(
    `/api/annotations/linking/${encodeURIComponent(linkingAnnotationId)}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Failed to delete ${motivation} relationship`,
    );
  }
}
