import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetCanvasId = searchParams.get('targetCanvasId');

  try {
    const ANNO_REPO_TOKEN = process.env.ANNO_REPO_TOKEN_JONA;
    if (!ANNO_REPO_TOKEN) {
      return NextResponse.json(
        { error: 'AnnoRepo token not configured' },
        { status: 500 },
      );
    }

    const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
    const CONTAINER = 'necessary-reunions';
    const endpoint = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}`;

    const headers: HeadersInit = {
      Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      Authorization: `Bearer ${ANNO_REPO_TOKEN}`,
    };

    let allLinkingAnnotations: any[] = [];

    // Search pages 230-231 where we know linking annotations exist
    const pagesToSearch = [230, 231];

    for (const pageNum of pagesToSearch) {
      try {
        const pageUrl = `${endpoint}?page=${pageNum}`;
        const response = await fetch(pageUrl, { headers });

        if (response.ok) {
          const data = await response.json();
          const pageAnnotations = data.items || [];

          const linkingAnnotationsOnPage = pageAnnotations.filter(
            (annotation: any) => annotation.motivation === 'linking',
          );

          allLinkingAnnotations.push(...linkingAnnotationsOnPage);
        }
      } catch (error) {
        console.warn(`Could not fetch page ${pageNum}:`, error);
      }
    }

    // If no targetCanvasId provided, return all linking annotations
    if (!targetCanvasId) {
      return NextResponse.json({
        annotations: allLinkingAnnotations,
        iconStates: {},
      });
    }

    // Filter linking annotations for the specific canvas
    // Since fetching all targets is slow, we'll use a sampling approach
    const relevantLinkingAnnotations: any[] = [];
    const maxAnnotationsToProcess = 30; // Limit to prevent timeout
    const annotationsToCheck = allLinkingAnnotations.slice(
      0,
      maxAnnotationsToProcess,
    );

    for (const linkingAnnotation of annotationsToCheck) {
      if (
        !linkingAnnotation.target ||
        !Array.isArray(linkingAnnotation.target)
      ) {
        continue;
      }

      // Check first few targets to see if any match our canvas
      const maxTargetsToCheck = 3;
      const targetsToCheck = linkingAnnotation.target.slice(
        0,
        maxTargetsToCheck,
      );

      let isRelevant = false;

      for (const targetUrl of targetsToCheck) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout per target

          const targetResponse = await fetch(targetUrl, {
            headers,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (targetResponse.ok) {
            const targetData = await targetResponse.json();
            if (targetData.target?.source === targetCanvasId) {
              isRelevant = true;
              break; // Found a match, no need to check more targets
            }
          }
        } catch (error) {
          // Continue to next target if this one fails
        }
      }

      if (isRelevant) {
        relevantLinkingAnnotations.push(linkingAnnotation);
      }
    }

    // Create simple icon states
    const iconStates: Record<
      string,
      { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
    > = {};

    relevantLinkingAnnotations.forEach((annotation: any) => {
      if (annotation.target && Array.isArray(annotation.target)) {
        annotation.target.forEach((targetUrl: string) => {
          if (!iconStates[targetUrl]) {
            iconStates[targetUrl] = {
              hasGeotag: false,
              hasPoint: false,
              isLinked: true,
            };
          }
        });
      }
    });

    return NextResponse.json({
      annotations: relevantLinkingAnnotations,
      iconStates,
      debug: {
        totalLinkingAnnotations: allLinkingAnnotations.length,
        processedAnnotations: annotationsToCheck.length,
        relevantAnnotations: relevantLinkingAnnotations.length,
        targetCanvasId,
      },
    });
  } catch (error) {
    console.error('Error in simplified linking bulk API:', error);
    return NextResponse.json(
      {
        annotations: [],
        iconStates: {},
        message: 'Service temporarily unavailable',
        error: false,
      },
      { status: 200 },
    );
  }
}
