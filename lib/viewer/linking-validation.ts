/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

export interface AnnotationConflict {
  annotationId: string;
  existingLinkingId: string;
  motivation: string;
  conflictType: 'linking' | 'geotagging';
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
      const data = (await response.json()) as {
        isValid: boolean;
        conflicts?: AnnotationConflict[];
        warnings?: string[];
        mergeable?: ValidationResult['mergeable'];
      };
      return {
        isValid: data.isValid,
        conflicts: data.conflicts ?? [],
        warnings: data.warnings ?? [],
        mergeable: data.mergeable ?? [],
      };
    } else {
      return {
        isValid: false,
        conflicts: [],
        warnings: ['Failed to validate annotations - server error'],
        mergeable: [],
      };
    }
  } catch {
    return {
      isValid: false,
      conflicts: [],
      warnings: ['Failed to validate annotations - network error'],
      mergeable: [],
    };
  }
}

export async function getLinkingAnnotationsForAnnotation(
  annotationId: string,
  canvasId?: string,
): Promise<{
  linking?: any;
  geotagging?: any;
  pointSelection?: any;
}> {
  const result: {
    linking?: any;
    geotagging?: any;
    pointSelection?: any;
  } = {};

  try {
    let actualCanvasId = canvasId;
    if (!actualCanvasId && annotationId.includes('#')) {
      const parts = annotationId.split('#');
      if (parts.length > 1) {
        actualCanvasId = parts[0];
      }
    }

    // Use global linking annotations bulk endpoint instead of canvas-specific
    // because the canvas-specific cache might not have loaded yet
    const apiUrl = '/api/annotations/linking-bulk?page=0&limit=10000';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 10000);

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      cache: 'no-cache',
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = (await response.json()) as { annotations?: any[] };
      const linkingAnnotations = data.annotations ?? [];

      for (const linkingAnnotation of linkingAnnotations) {
        const targets = Array.isArray(linkingAnnotation.target)
          ? linkingAnnotation.target
          : [linkingAnnotation.target];

        if (targets.includes(annotationId)) {
          result.linking = linkingAnnotation;

          if (linkingAnnotation.body && Array.isArray(linkingAnnotation.body)) {
            for (const bodyItem of linkingAnnotation.body) {
              if (bodyItem.purpose === 'geotagging') {
                result.geotagging = bodyItem;
              } else if (
                bodyItem.purpose === 'selecting' &&
                bodyItem.selector?.type === 'PointSelector'
              ) {
                result.pointSelection = bodyItem;
              }
            }
          }
          break;
        }
      }
    }
  } catch {
    // Silent fail - errors are handled at caller level
  }

  return result;
}

export async function deleteLinkingRelationship(
  linkingAnnotationId: string,
  motivation: 'linking' | 'geotagging',
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
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      errorData.error ?? `Failed to delete ${motivation} relationship`,
    );
  }
}
