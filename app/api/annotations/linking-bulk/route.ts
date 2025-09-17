import { encodeCanvasUri } from '@/lib/shared/utils';
import { NextRequest, NextResponse } from 'next/server';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const QUERY_NAME = 'with-target-and-motivation-or-purpose';

// Helper function to check if a linking annotation has targets on the current canvas
// Now uses a batch approach for better performance
async function filterLinkingAnnotationsByCanvas(
  linkingAnnotations: any[],
  targetCanvasId: string,
): Promise<any[]> {
  if (!targetCanvasId) return linkingAnnotations;

  // Extract all unique target annotation URLs
  const allTargetUrls = new Set<string>();
  linkingAnnotations.forEach((annotation) => {
    if (annotation.target && Array.isArray(annotation.target)) {
      annotation.target.forEach((url: string) => allTargetUrls.add(url));
    }
  });

  console.log(
    `Fetching ${allTargetUrls.size} unique target annotations for canvas filtering`,
  );

  // Fetch all target annotations in batches for better performance
  const targetAnnotations = new Map<string, any>();
  const batchSize = 10; // Fetch 10 at a time to avoid overwhelming the server
  const targetUrlArray = Array.from(allTargetUrls);

  for (let i = 0; i < targetUrlArray.length; i += batchSize) {
    const batch = targetUrlArray.slice(i, i + batchSize);
    const promises = batch.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const annotation = await response.json();
          return { url, annotation };
        }
      } catch (error) {
        console.warn(`Failed to fetch target annotation ${url}:`, error);
      }
      return null;
    });

    const results = await Promise.all(promises);
    results.forEach((result) => {
      if (result) {
        targetAnnotations.set(result.url, result.annotation);
      }
    });
  }

  // Now filter linking annotations based on their targets
  const filteredAnnotations = linkingAnnotations.filter((linkingAnnotation) => {
    if (!linkingAnnotation.target) return false;

    // Check if any target annotation belongs to the current canvas
    return linkingAnnotation.target.some((targetUrl: string) => {
      const targetAnnotation = targetAnnotations.get(targetUrl);
      if (!targetAnnotation || !targetAnnotation.target) return false;

      // Check if the target annotation's source matches our canvas
      return targetAnnotation.target.source === targetCanvasId;
    });
  });

  console.log(
    `Filtered ${linkingAnnotations.length} linking annotations to ${filteredAnnotations.length} for canvas ${targetCanvasId}`,
  );
  return filteredAnnotations;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetCanvasId = searchParams.get('targetCanvasId');

  // targetCanvasId is now optional since we fetch all linking annotations
  // but we still use it for logging purposes
  console.log(
    'Bulk linking API: Called with targetCanvasId:',
    targetCanvasId || 'none',
  );

  try {
    // Fetch ALL linking annotations first, then filter by canvas relevance
    // A linking annotation is relevant if ANY of its targets belong to the current canvas

    console.log('Bulk linking API: Target canvas ID:', targetCanvasId);

    // Use the custom query endpoint for linking annotations
    // This endpoint fetches all linking annotations efficiently
    const customQueryUrl = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==`;

    console.log(
      'Bulk linking API: Trying custom query for all linking annotations:',
      customQueryUrl,
    );

    const headers: HeadersInit = {
      Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
    };

    try {
      const response = await fetch(customQueryUrl, { headers });

      if (response.ok) {
        const data = await response.json();
        const allLinkingAnnotations = data.items || [];

        console.log(
          'Bulk linking API: Custom query successful, found',
          allLinkingAnnotations.length,
          'total linking annotations',
        );

        // Filter linking annotations to only include those relevant to the current canvas
        const relevantLinkingAnnotations =
          await filterLinkingAnnotationsByCanvas(
            allLinkingAnnotations,
            targetCanvasId || '',
          );

        const iconStates: Record<
          string,
          { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
        > = {};

        console.log(
          'Bulk linking API: Processing icon states for',
          relevantLinkingAnnotations.length,
          'relevant annotations',
        );

        // Now process all target annotations for relevant linking annotations to create icon states
        const allTargetUrls = new Set<string>();
        relevantLinkingAnnotations.forEach((annotation) => {
          if (annotation.target && Array.isArray(annotation.target)) {
            annotation.target.forEach((url: string) => allTargetUrls.add(url));
          }
        });

        // Fetch target annotations in batches for icon state creation
        const batchSize = 10;
        const targetUrlArray = Array.from(allTargetUrls);

        for (let i = 0; i < targetUrlArray.length; i += batchSize) {
          const batch = targetUrlArray.slice(i, i + batchSize);
          const promises = batch.map(async (targetUrl) => {
            try {
              const targetResponse = await fetch(targetUrl, {
                headers: {
                  Accept:
                    'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
                },
              });

              if (targetResponse.ok) {
                const targetAnnotation = await targetResponse.json();

                // Only create icon states for annotations on the current canvas
                if (
                  targetAnnotation.target &&
                  targetAnnotation.target.source === targetCanvasId
                ) {
                  const body = Array.isArray(targetAnnotation.body)
                    ? targetAnnotation.body
                    : [targetAnnotation.body];

                  const hasGeotag = body.some(
                    (b: any) => b?.purpose === 'geotagging',
                  );
                  const hasPoint = body.some(
                    (b: any) => b?.purpose === 'selecting',
                  );

                  // Check if this target is linked (appears in multiple linking annotations)
                  const isLinked = relevantLinkingAnnotations.some(
                    (linkingAnnotation) => {
                      const targets = Array.isArray(linkingAnnotation.target)
                        ? linkingAnnotation.target
                        : [linkingAnnotation.target];
                      return targets.includes(targetUrl) && targets.length > 1;
                    },
                  );

                  return {
                    url: targetUrl,
                    state: {
                      hasGeotag: iconStates[targetUrl]?.hasGeotag || hasGeotag,
                      hasPoint: iconStates[targetUrl]?.hasPoint || hasPoint,
                      isLinked: iconStates[targetUrl]?.isLinked || isLinked,
                    },
                  };
                }
              }
            } catch (error) {
              console.warn(
                `Failed to fetch target annotation ${targetUrl}:`,
                error,
              );
            }
            return null;
          });

          const results = await Promise.all(promises);
          results.forEach((result) => {
            if (result) {
              iconStates[result.url] = result.state;
            }
          });
        }

        console.log(
          'Bulk linking API: Filtered to',
          relevantLinkingAnnotations.length,
          'relevant linking annotations for canvas',
        );
        console.log(
          'Bulk linking API: Created',
          Object.keys(iconStates).length,
          'icon states for current canvas',
        );

        return NextResponse.json({
          annotations: relevantLinkingAnnotations,
          iconStates,
        });
      } else {
        console.warn(
          `Bulk linking API: Custom query failed with ${response.status}, falling back to page-based approach`,
        );
      }
    } catch (error) {
      console.warn(
        'Bulk linking API: Custom query failed, falling back to page-based approach:',
        error,
      );
    }

    // Fallback: Use page-based approach with dynamic page discovery
    console.log('Bulk linking API: Using fallback page-based approach');

    const endpoint = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}`;
    let allLinkingAnnotations: any[] = [];

    // Start from page 222 where linking annotations first appear
    // Use a more expansive search range since pages will grow over time
    let currentPage = 222;
    let hasMorePages = true;
    const maxPagesToCheck = 100; // Search up to 100 pages from start (covers growth)
    const endPage = currentPage + maxPagesToCheck; // Stop at page 322
    let consecutiveEmptyPages = 0;
    const maxConsecutiveEmpty = 10; // Stop after 10 consecutive pages with no linking annotations

    console.log(
      'Bulk linking API: Starting dynamic page fetch from page',
      currentPage,
      '(linking annotations start here and will grow beyond page 234)',
    );

    while (
      hasMorePages &&
      currentPage <= endPage &&
      consecutiveEmptyPages < maxConsecutiveEmpty
    ) {
      try {
        const pageUrl = `${endpoint}?page=${currentPage}`;
        console.log(
          `Bulk linking API: Fetching page ${currentPage} from:`,
          pageUrl,
        );

        const response = await fetch(pageUrl, { headers });

        console.log(
          `Bulk linking API: Response status for page ${currentPage}: ${response.status}`,
        );

        if (response.ok) {
          const data = await response.json();
          const pageAnnotations = data.items || [];

          console.log(
            `Bulk linking API: Page ${currentPage} returned ${pageAnnotations.length} annotations`,
          );

          const linkingAnnotationsOnPage = pageAnnotations.filter(
            (annotation: any) => annotation.motivation === 'linking',
          );

          console.log(
            `Bulk linking API: Found ${linkingAnnotationsOnPage.length} linking annotations on page ${currentPage} (${pageAnnotations.length} total annotations)`,
          );

          if (linkingAnnotationsOnPage.length === 0) {
            consecutiveEmptyPages++;
            console.log(
              `Bulk linking API: Page ${currentPage} has no linking annotations (${consecutiveEmptyPages}/${maxConsecutiveEmpty} consecutive empty)`,
            );
          } else {
            consecutiveEmptyPages = 0; // Reset counter when we find linking annotations
            allLinkingAnnotations.push(...linkingAnnotationsOnPage);
          }

          // If page is completely empty, it might be beyond the end
          if (pageAnnotations.length === 0) {
            console.log(
              `Bulk linking API: Page ${currentPage} is completely empty, likely beyond the end`,
            );
            hasMorePages = false;
            break;
          }
        } else {
          console.warn(
            `Bulk linking API: Failed to fetch page ${currentPage}: ${response.status}`,
          );
          // Don't stop on individual page failures, continue to next page
          consecutiveEmptyPages++;
        }
      } catch (error) {
        console.error(
          `Bulk linking API: Error fetching page ${currentPage}:`,
          error,
        );
        hasMorePages = false;
      }

      currentPage++;
    }

    const items = allLinkingAnnotations;

    console.log(
      'Bulk linking API: Fetched all linking annotations, count:',
      items.length,
    );

    // Filter linking annotations to only include those relevant to the current canvas
    const relevantLinkingAnnotations = await filterLinkingAnnotationsByCanvas(
      items,
      targetCanvasId || '',
    );

    const iconStates: Record<
      string,
      { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
    > = {};

    console.log(
      'Bulk linking API: Processing icon states for',
      relevantLinkingAnnotations.length,
      'relevant annotations (fallback)',
    );

    // Now process all target annotations for relevant linking annotations to create icon states
    const allTargetUrls = new Set<string>();
    relevantLinkingAnnotations.forEach((annotation) => {
      if (annotation.target && Array.isArray(annotation.target)) {
        annotation.target.forEach((url: string) => allTargetUrls.add(url));
      }
    });

    // Fetch target annotations in batches for icon state creation
    const batchSize = 10;
    const targetUrlArray = Array.from(allTargetUrls);

    for (let i = 0; i < targetUrlArray.length; i += batchSize) {
      const batch = targetUrlArray.slice(i, i + batchSize);
      const promises = batch.map(async (targetUrl) => {
        try {
          const targetResponse = await fetch(targetUrl, {
            headers: {
              Accept:
                'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
            },
          });

          if (targetResponse.ok) {
            const targetAnnotation = await targetResponse.json();

            // Only create icon states for annotations on the current canvas
            if (
              targetAnnotation.target &&
              targetAnnotation.target.source === targetCanvasId
            ) {
              const body = Array.isArray(targetAnnotation.body)
                ? targetAnnotation.body
                : [targetAnnotation.body];

              const hasGeotag = body.some(
                (b: any) => b?.purpose === 'geotagging',
              );
              const hasPoint = body.some(
                (b: any) => b?.purpose === 'selecting',
              );

              // Check if this target is linked (appears in multiple linking annotations)
              const isLinked = relevantLinkingAnnotations.some(
                (linkingAnnotation) => {
                  const targets = Array.isArray(linkingAnnotation.target)
                    ? linkingAnnotation.target
                    : [linkingAnnotation.target];
                  return targets.includes(targetUrl) && targets.length > 1;
                },
              );

              return {
                url: targetUrl,
                state: {
                  hasGeotag: iconStates[targetUrl]?.hasGeotag || hasGeotag,
                  hasPoint: iconStates[targetUrl]?.hasPoint || hasPoint,
                  isLinked: iconStates[targetUrl]?.isLinked || isLinked,
                },
              };
            }
          }
        } catch (error) {
          console.warn(
            `Failed to fetch target annotation ${targetUrl}:`,
            error,
          );
        }
        return null;
      });

      const results = await Promise.all(promises);
      results.forEach((result) => {
        if (result) {
          iconStates[result.url] = result.state;
        }
      });
    }

    console.log(
      'Bulk linking API: Filtered to',
      relevantLinkingAnnotations.length,
      'relevant linking annotations for canvas',
    );
    console.log(
      'Bulk linking API: Created',
      Object.keys(iconStates).length,
      'icon states for current canvas',
    );

    return NextResponse.json({
      annotations: relevantLinkingAnnotations,
      iconStates,
    });
  } catch (error) {
    console.error('Error fetching bulk linking annotations:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
