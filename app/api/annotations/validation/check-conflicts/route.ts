import { resolveAnnoRepoConfig } from '@/lib/shared/annorepo-config';
import { NextResponse } from 'next/server';

interface ExistingAnnotation {
  id: string;
  [key: string]: unknown;
}

interface AnnotationPageResponse {
  items?: unknown[];
  [key: string]: unknown;
}

interface ConflictItem {
  annotationId: string;
  existingLinkingId: string;
  motivation: string;
  conflictType: string;
}

interface ConflictsResponse {
  conflicts: ConflictItem[];
}

interface ErrorResponse {
  error: string;
}

export async function GET(
  request: Request,
): Promise<NextResponse<ConflictsResponse | ErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const motivation = searchParams.get('motivation');
    const annotationIds = searchParams.get('annotationIds')?.split(',') || [];
    const excludeLinkingId = searchParams.get('exclude');

    if (!motivation || annotationIds.length === 0) {
      return NextResponse.json({ conflicts: [] });
    }

    const project = searchParams.get('project') || 'neru';
    const config = resolveAnnoRepoConfig(project);

    const endpoint = `${config.baseUrl}/services/${config.container}/custom-query/${config.customQueryName}`;

    const conflicts: Array<{
      annotationId: string;
      existingLinkingId: string;
      motivation: string;
      conflictType: string;
    }> = [];

    for (const annotationId of annotationIds) {
      try {
        const encodedTarget = btoa(annotationId);
        const queryUrl = `${endpoint}:target=${encodedTarget},motivationorpurpose=${motivation}`;

        const response = await fetch(queryUrl, {
          headers: {
            Accept:
              'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
          },
        });

        if (response.ok) {
          const data = (await response.json()) as AnnotationPageResponse;
          const existingAnnotations = Array.isArray(data.items)
            ? (data.items as ExistingAnnotation[])
            : [];

          for (const existing of existingAnnotations) {
            if (
              excludeLinkingId &&
              (existing.id === excludeLinkingId ||
                existing.id.endsWith(excludeLinkingId))
            ) {
              continue;
            }

            conflicts.push({
              annotationId,
              existingLinkingId: existing.id,
              motivation: atob(motivation),
              conflictType: atob(motivation),
            });
          }
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        console.error(
          `Error checking conflicts for annotation ${annotationId}:`,
          errorMessage,
        );
      }
    }

    return NextResponse.json({ conflicts });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in conflict validation:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to validate conflicts' },
      { status: 500 },
    );
  }
}
