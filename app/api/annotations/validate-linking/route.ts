import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { annotationIds, excludeLinkingId } = await request.json();

    if (!annotationIds || annotationIds.length === 0) {
      return NextResponse.json({
        isValid: true,
        conflicts: [],
        warnings: [],
        mergeable: [],
      });
    }

    const ANNOREPO_BASE_URL =
      process.env.ANNOREPO_BASE_URL ||
      'https://annorepo.globalise.huygens.knaw.nl';
    const CONTAINER = 'necessary-reunions';

    const conflicts: Array<{
      annotationId: string;
      existingLinkingId: string;
      motivation: string;
      conflictType: string;
    }> = [];

    const mergeable: Array<{
      annotationId: string;
      existingLinkingId: string;
      existingContent: string[];
      canMerge: boolean;
      reason: string;
    }> = [];

    const warnings: string[] = [];

    for (const annotationId of annotationIds) {
      const existingLinks = await getExistingLinksForAnnotation(
        annotationId,
        ANNOREPO_BASE_URL,
        CONTAINER,
      );

      for (const link of existingLinks) {
        if (
          excludeLinkingId &&
          (link.id === excludeLinkingId || link.id.endsWith(excludeLinkingId))
        ) {
          continue;
        }

        const contentTypes = analyzeLinkingContent(link);

        const mergeAnalysis = canMergeWithExisting(
          contentTypes,
          annotationIds,
          existingLinks,
        );

        if (mergeAnalysis.canMerge) {
          mergeable.push({
            annotationId,
            existingLinkingId: link.id,
            existingContent: contentTypes,
            canMerge: true,
            reason: mergeAnalysis.reason,
          });
        } else {
          conflicts.push({
            annotationId,
            existingLinkingId: link.id,
            motivation: link.motivation || 'linking',
            conflictType: mergeAnalysis.conflictType || 'linking',
          });
        }
      }
    }

    if (mergeable.length > 0) {
      warnings.push(
        `Found ${mergeable.length} existing linking annotation(s) that can be merged with this one.`,
      );
    }

    return NextResponse.json({
      isValid: conflicts.length === 0,
      conflicts,
      warnings,
      mergeable,
    });
  } catch (error) {
    console.error('Error in linking validation:', error);
    return NextResponse.json(
      { error: 'Failed to validate linking annotations' },
      { status: 500 },
    );
  }
}

async function getExistingLinksForAnnotation(
  annotationId: string,
  baseUrl: string,
  container: string,
) {
  const existingLinks: any[] = [];

  const motivations = ['linking', 'geotagging'];

  for (const motivation of motivations) {
    try {
      const endpoint = `${baseUrl}/services/${container}/custom-query/with-target-and-motivation-or-purpose`;
      const encodedTarget = btoa(annotationId);
      const encodedMotivation = btoa(motivation);
      const queryUrl = `${endpoint}:target=${encodedTarget},motivationorpurpose=${encodedMotivation}`;

      const response = await fetch(queryUrl, {
        headers: {
          Accept:
            'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const annotations = Array.isArray(data.items) ? data.items : [];
        existingLinks.push(...annotations);
      }
    } catch (error) {
      console.error(
        `Error fetching ${motivation} links for ${annotationId}:`,
        error,
      );
    }
  }

  return existingLinks;
}

function analyzeLinkingContent(linkingAnnotation: any): string[] {
  const contentTypes: string[] = [];

  if (linkingAnnotation.motivation === 'linking') {
    contentTypes.push('linking');
  }

  if (Array.isArray(linkingAnnotation.body)) {
    for (const body of linkingAnnotation.body) {
      if (body.purpose === 'geotagging') {
        contentTypes.push('geotagging');
      } else if (
        body.purpose === 'selecting' &&
        body.selector?.type === 'PointSelector'
      ) {
        contentTypes.push('point_selection');
      }
    }
  } else if (linkingAnnotation.body) {
    const body = linkingAnnotation.body;
    if (body.purpose === 'geotagging') {
      contentTypes.push('geotagging');
    } else if (
      body.purpose === 'selecting' &&
      body.selector?.type === 'PointSelector'
    ) {
      contentTypes.push('point_selection');
    }
  }

  if (
    Array.isArray(linkingAnnotation.target) &&
    linkingAnnotation.target.length > 1
  ) {
    if (!contentTypes.includes('linking')) {
      contentTypes.push('linking');
    }
  }

  return [...new Set(contentTypes)];
}

function canMergeWithExisting(
  existingContentTypes: string[],
  newAnnotationIds: string[],
  allExistingLinks: any[],
): { canMerge: boolean; reason: string; conflictType?: string } {
  const hasLinking = existingContentTypes.includes('linking');
  const hasGeotagging = existingContentTypes.includes('geotagging');
  const hasPointSelection = existingContentTypes.includes('point_selection');

  for (const annotationId of newAnnotationIds) {
    const linksForThisAnnotation = allExistingLinks.filter((link) =>
      Array.isArray(link.target)
        ? link.target.includes(annotationId)
        : link.target === annotationId,
    );

    for (const link of linksForThisAnnotation) {
      const linkContent = analyzeLinkingContent(link);
      if (linkContent.includes('linking')) {
        const existingTargets = Array.isArray(link.target)
          ? link.target
          : [link.target];
        const otherLinkedAnnotations = existingTargets.filter(
          (target: string) => target !== annotationId,
        );

        const newOtherAnnotations = newAnnotationIds.filter(
          (id) => id !== annotationId,
        );
        const hasConflictingLinks = otherLinkedAnnotations.some(
          (existing: string) => !newOtherAnnotations.includes(existing),
        );

        if (hasConflictingLinks) {
          return {
            canMerge: false,
            reason: `Annotation ${annotationId} is already linked to different annotations`,
            conflictType: 'linking',
          };
        }
      }
    }
  }

  const complementaryContent = [];
  if (!hasLinking && newAnnotationIds.length > 1) {
    complementaryContent.push('would add linking');
  }
  if (!hasGeotagging) {
    complementaryContent.push('could add geotagging');
  }
  if (!hasPointSelection) {
    complementaryContent.push('could add point selection');
  }

  if (complementaryContent.length > 0) {
    return {
      canMerge: true,
      reason: `Can merge: ${complementaryContent.join(', ')}`,
    };
  }

  return {
    canMerge: false,
    reason:
      'Cannot add the same type of content to existing linking annotation',
    conflictType: existingContentTypes[0] || 'linking',
  };
}
