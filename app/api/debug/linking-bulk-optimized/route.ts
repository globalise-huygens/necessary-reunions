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

    if (!targetCanvasId) {
      return NextResponse.json({
        annotations: [],
        iconStates: {},
        error: 'No target canvas ID provided',
      });
    }

    const relevantLinkingAnnotations: any[] = [];
    const maxAnnotationsToFind = 10; // Stop after finding this many relevant annotations

    // Search pages in reverse order (231 to 220) since newer annotations might be more relevant
    // Process pages individually to avoid memory issues with all 436 annotations
    for (let pageNum = 231; pageNum >= 220; pageNum--) {
      if (relevantLinkingAnnotations.length >= maxAnnotationsToFind) {
        break; // Found enough annotations
      }

      try {
        const pageUrl = `${endpoint}?page=${pageNum}`;
        const response = await fetch(pageUrl, { headers });

        if (response.ok) {
          const data = await response.json();
          const pageAnnotations = data.items || [];

          const linkingAnnotationsOnPage = pageAnnotations.filter(
            (annotation: any) => annotation.motivation === 'linking',
          );

          // Process linking annotations from this page
          for (const linkingAnnotation of linkingAnnotationsOnPage) {
            if (relevantLinkingAnnotations.length >= maxAnnotationsToFind) {
              break;
            }

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
                const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout per target

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
        }
      } catch (error) {
        console.warn(`Could not process page ${pageNum}:`, error);
        continue; // Continue to next page
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
        targetCanvasId,
        relevantAnnotations: relevantLinkingAnnotations.length,
        searchStrategy: 'page-by-page-reverse-order',
      },
    });
  } catch (error) {
    console.error('Error in optimized linking bulk API:', error);
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
