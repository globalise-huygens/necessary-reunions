import { NextRequest, NextResponse } from 'next/server';

interface Annotation {
  id: string;
  motivation?: string;
  target?: string | string[];
  body?: unknown;
  created?: string;
  modified?: string;
  [key: string]: unknown;
}

interface ValidationResult {
  hasId: boolean;
  hasMotivation: boolean;
  motivationValue: unknown;
  hasTarget: boolean;
  targetType: string;
  targetCount: number;
  hasBody: boolean;
  bodyType: string;
  bodyCount: number;
  issues: string[];
}

interface OrphanedTarget {
  linkingId: string;
  allTargets: string[];
  orphanedTargets: string[];
  validTargets: string[];
}

interface DuplicateGroup {
  targets: string[];
  count: number;
  annotations: Array<{
    id: string;
    created?: string;
    modified?: string;
  }>;
}

interface DebugInfo {
  timestamp: string;
  canvasId: string | null;
  annotationId: string | null;
  action: string;
  baseUrl: string;
  summary?: {
    totalAnnotations: number;
    uniqueAnnotations: number;
    duplicateCount: number;
    motivationCounts: Record<string, number>;
    categories: {
      regular: number;
      linking: number;
      geotagging: number;
      duplicates: number;
    };
  };
  annotations?: {
    regular: Annotation[];
    linking: Annotation[];
    geotagging: Annotation[];
    orphaned: Annotation[];
    duplicates: Annotation[];
  };
  error?: string;
  annotation?: Annotation | null;
  validation?: ValidationResult;
  duplicateAnalysis?: {
    totalLinkingAnnotations: number;
    uniqueTargetSets: number;
    duplicateGroups: number;
    details: DuplicateGroup[];
  };
  orphanedAnalysis?: {
    totalAnnotations: number;
    existingIds: number;
    orphanedLinkingAnnotations: number;
    details: OrphanedTarget[];
  };
}

interface ErrorResponse {
  error: string;
  message?: string;
  timestamp: string;
  canvasId: string | null;
  annotationId: string | null;
  action: string;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<DebugInfo | ErrorResponse | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const canvasId = searchParams.get('canvas');
  const annotationId = searchParams.get('annotation');
  const action = searchParams.get('action') || 'overview';

  try {
    if (!canvasId) {
      return NextResponse.json(
        { error: 'canvasId parameter is required' },
        { status: 400 },
      );
    }

    const baseUrl = process.env.ANNO_REPO_BASE_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'ANNO_REPO_BASE_URL not configured' },
        { status: 500 },
      );
    }

    const debugInfo: DebugInfo = {
      timestamp: new Date().toISOString(),
      canvasId,
      annotationId,
      action,
      baseUrl,
    };

    switch (action) {
      case 'overview':
        const allAnnotationsUrl = `${baseUrl}/services/search/canvas?canvas=${encodeURIComponent(
          canvasId,
        )}`;
        const allResponse = await fetch(allAnnotationsUrl);

        if (!allResponse.ok) {
          throw new Error(`Failed to fetch annotations: ${allResponse.status}`);
        }

        const allAnnotations = (await allResponse.json()) as Annotation[];

        const categories = {
          regular: [] as Annotation[],
          linking: [] as Annotation[],
          geotagging: [] as Annotation[],
          orphaned: [] as Annotation[],
          duplicates: [] as Annotation[],
        };

        const seenIds = new Set<string>();
        const motivationCounts: Record<string, number> = {};

        for (const annotation of allAnnotations) {
          if (seenIds.has(annotation.id)) {
            categories.duplicates.push(annotation);
            continue;
          }
          seenIds.add(annotation.id);

          const motivation = annotation.motivation ?? 'unknown';
          motivationCounts[motivation] =
            (motivationCounts[motivation] || 0) + 1;

          if (motivation === 'linking') {
            categories.linking.push(annotation);
          } else if (motivation === 'geotagging') {
            categories.geotagging.push(annotation);
          } else {
            categories.regular.push(annotation);
          }
        }

        debugInfo.summary = {
          totalAnnotations: allAnnotations.length,
          uniqueAnnotations: seenIds.size,
          duplicateCount: categories.duplicates.length,
          motivationCounts,
          categories: {
            regular: categories.regular.length,
            linking: categories.linking.length,
            geotagging: categories.geotagging.length,
            duplicates: categories.duplicates.length,
          },
        };

        debugInfo.annotations = categories;
        break;

      case 'validate-linking':
        if (!annotationId) {
          return NextResponse.json(
            { error: 'annotationId parameter required for validation' },
            { status: 400 },
          );
        }

        const annotationUrl = `${baseUrl}/services/get/${encodeURIComponent(
          annotationId,
        )}`;
        const response = await fetch(annotationUrl);

        if (!response.ok) {
          debugInfo.error = `Failed to fetch annotation: ${response.status}`;
          debugInfo.annotation = null;
        } else {
          const annotation = (await response.json()) as Annotation;
          debugInfo.annotation = annotation;

          const validation: ValidationResult = {
            hasId: !!annotation.id,
            hasMotivation: !!annotation.motivation,
            motivationValue: annotation.motivation,
            hasTarget: !!annotation.target,
            targetType: Array.isArray(annotation.target)
              ? 'array'
              : typeof annotation.target,
            targetCount: Array.isArray(annotation.target)
              ? annotation.target.length
              : 1,
            hasBody: !!annotation.body,
            bodyType: Array.isArray(annotation.body)
              ? 'array'
              : typeof annotation.body,
            bodyCount: Array.isArray(annotation.body)
              ? annotation.body.length
              : 1,
            issues: [] as string[],
          };

          if (!annotation.motivation) {
            validation.issues.push('Missing motivation field');
          }

          if (!annotation.target) {
            validation.issues.push('Missing target field');
          } else if (
            Array.isArray(annotation.target) &&
            annotation.target.length === 0
          ) {
            validation.issues.push('Empty target array');
          }

          if (!annotation.body) {
            validation.issues.push('Missing body field');
          } else if (
            Array.isArray(annotation.body) &&
            annotation.body.length === 0
          ) {
            validation.issues.push('Empty body array');
          }

          if (annotation.motivation === 'linking') {
            if (
              Array.isArray(annotation.target) &&
              annotation.target.length < 2
            ) {
              validation.issues.push(
                'Linking annotation should have at least 2 targets',
              );
            }
          }

          debugInfo.validation = validation;
        }
        break;

      case 'check-duplicates':
        const linkingUrl = `${baseUrl}/services/search/canvas?canvas=${encodeURIComponent(
          canvasId,
        )}&motivation=linking`;
        const linkingResponse = await fetch(linkingUrl);

        if (!linkingResponse.ok) {
          throw new Error(
            `Failed to fetch linking annotations: ${linkingResponse.status}`,
          );
        }

        const linkingAnnotations =
          (await linkingResponse.json()) as Annotation[];

        const targetGroups: Record<string, Annotation[]> = {};

        for (const annotation of linkingAnnotations) {
          if (annotation.target && Array.isArray(annotation.target)) {
            const sortedTargets = [...annotation.target].sort();
            const key = sortedTargets.join('|');

            if (!targetGroups[key]) {
              targetGroups[key] = [];
            }
            targetGroups[key].push(annotation);
          }
        }

        const duplicateGroups = Object.entries(targetGroups)
          .filter(([, annotations]) => annotations.length > 1)
          .map(
            ([targets, annotations]): DuplicateGroup => ({
              targets: targets.split('|'),
              count: annotations.length,
              annotations: annotations.map((a) => ({
                id: a.id,
                created: a.created,
                modified: a.modified,
              })),
            }),
          );

        debugInfo.duplicateAnalysis = {
          totalLinkingAnnotations: linkingAnnotations.length,
          uniqueTargetSets: Object.keys(targetGroups).length,
          duplicateGroups: duplicateGroups.length,
          details: duplicateGroups,
        };
        break;

      case 'orphaned-targets':
        const allUrl = `${baseUrl}/services/search/canvas?canvas=${encodeURIComponent(
          canvasId,
        )}`;
        const allResp = await fetch(allUrl);

        if (!allResp.ok) {
          throw new Error(`Failed to fetch annotations: ${allResp.status}`);
        }

        const annotations = (await allResp.json()) as Annotation[];

        const existingIds = new Set(annotations.map((a) => a.id));

        const orphanedTargets: OrphanedTarget[] = [];

        for (const annotation of annotations) {
          if (
            annotation.motivation === 'linking' &&
            annotation.target &&
            Array.isArray(annotation.target)
          ) {
            const missingTargets = annotation.target.filter(
              (targetId: string) => !existingIds.has(targetId),
            );

            if (missingTargets.length > 0) {
              orphanedTargets.push({
                linkingId: annotation.id,
                allTargets: annotation.target,
                orphanedTargets: missingTargets,
                validTargets: annotation.target.filter((targetId: string) =>
                  existingIds.has(targetId),
                ),
              });
            }
          }
        }

        debugInfo.orphanedAnalysis = {
          totalAnnotations: annotations.length,
          existingIds: existingIds.size,
          orphanedLinkingAnnotations: orphanedTargets.length,
          details: orphanedTargets,
        };
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }

    return NextResponse.json(debugInfo, { status: 200 });
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error');
    console.error('Debug linking error:', error);
    return NextResponse.json(
      {
        error: 'Debug failed',
        message: error.message,
        timestamp: new Date().toISOString(),
        canvasId,
        annotationId,
        action,
      },
      { status: 500 },
    );
  }
}
