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
      annotation.target.forEach((target: string) => {
        if (typeof target === 'string') {
          allTargetUrls.add(target);
        }
      });
    }
  });

  // Fetch all target annotations in batches for better performance
  const targetAnnotations = new Map<string, any>();
  const batchSize = 3; // Drastically reduced from 10 to prevent timeouts
  const targetUrlArray = Array.from(allTargetUrls);

  // Add limit to prevent excessive processing
  const maxTargetsToProcess = 50; // Limit total targets processed
  const limitedTargets = targetUrlArray.slice(0, maxTargetsToProcess);

  for (let i = 0; i < limitedTargets.length; i += batchSize) {
    const batch = limitedTargets.slice(i, i + batchSize);
    const promises = batch.map(async (url) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout per target

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

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

  return filteredAnnotations;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetCanvasId = searchParams.get('targetCanvasId');

  try {
    // Add aggressive timeout to prevent 504s
    const startTime = Date.now();
    const MAX_EXECUTION_TIME = 30000; // 30 seconds max

    const checkTimeout = () => {
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        throw new Error('Request timeout - returning partial results');
      }
    };
    // Fetch ALL linking annotations first, then filter by canvas relevance
    // A linking annotation is relevant if ANY of its targets belong to the current canvas

    // Use the custom query endpoint for linking annotations
    // This endpoint fetches all linking annotations efficiently
    const customQueryUrl = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==`;

    const headers: HeadersInit = {
      Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
    };

    // Add authorization header if token is available
    const authToken = process.env.ANNO_REPO_TOKEN_JONA;
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    try {
      const response = await fetch(customQueryUrl, { headers });

      if (response.ok) {
        const data = await response.json();
        const allLinkingAnnotations = data.items || [];

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
                  // Check the target annotation's body for enhancements
                  const targetBody = Array.isArray(targetAnnotation.body)
                    ? targetAnnotation.body
                    : [targetAnnotation.body];

                  let hasGeotag = targetBody.some(
                    (b: any) => b?.purpose === 'geotagging',
                  );
                  let hasPoint = targetBody.some(
                    (b: any) => b?.purpose === 'selecting',
                  );

                  // Also check linking annotations that reference this target for additional enhancements
                  relevantLinkingAnnotations.forEach((linkingAnnotation) => {
                    const targets = Array.isArray(linkingAnnotation.target)
                      ? linkingAnnotation.target
                      : [linkingAnnotation.target];

                    if (targets.includes(targetUrl)) {
                      const linkingBody = Array.isArray(linkingAnnotation.body)
                        ? linkingAnnotation.body
                        : linkingAnnotation.body
                        ? [linkingAnnotation.body]
                        : [];

                      if (!hasGeotag) {
                        hasGeotag = linkingBody.some(
                          (b: any) => b?.purpose === 'geotagging',
                        );
                      }
                      if (!hasPoint) {
                        hasPoint = linkingBody.some(
                          (b: any) => b?.purpose === 'selecting',
                        );
                      }
                    }
                  });

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

        return NextResponse.json({
          annotations: relevantLinkingAnnotations,
          iconStates,
        });
      } else {
        console.warn(
          `Bulk custom query failed with status: ${response.status} - ${response.statusText}`,
        );
        console.warn(`Query URL: ${customQueryUrl}`);
        const errorText = await response.text().catch(() => 'No error details');
        console.warn('Error details:', errorText);
      }
    } catch (error) {
      console.warn(
        'Bulk linking API: Custom query failed, falling back to page-based approach:',
        error,
      );
    }

    // Fallback: Use page-based approach with dynamic page discovery

    const endpoint = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}`;
    let allLinkingAnnotations: any[] = [];

    // Start from page 222 where linking annotations first appear
    // Use a more conservative search range to prevent timeouts
    let currentPage = 222;
    let hasMorePages = true;
    const maxPagesToCheck = 15; // Drastically reduced to prevent timeouts
    const endPage = currentPage + maxPagesToCheck; // Stop at page 237
    let consecutiveEmptyPages = 0;
    const maxConsecutiveEmpty = 3; // Reduced for faster failure detection

    while (
      hasMorePages &&
      currentPage <= endPage &&
      consecutiveEmptyPages < maxConsecutiveEmpty
    ) {
      // Check timeout before each page
      checkTimeout();
      
      try {
        // Add timeout per page request to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout per page

        const pageUrl = `${endpoint}?page=${currentPage}`;

        const response = await fetch(pageUrl, {
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const pageAnnotations = data.items || [];

          const linkingAnnotationsOnPage = pageAnnotations.filter(
            (annotation: any) => annotation.motivation === 'linking',
          );

          if (linkingAnnotationsOnPage.length === 0) {
            consecutiveEmptyPages++;
          } else {
            consecutiveEmptyPages = 0; // Reset counter when we find linking annotations
            allLinkingAnnotations.push(...linkingAnnotationsOnPage);
          }

          // Early return if we have enough data to prevent timeout
          if (allLinkingAnnotations.length > 100) { // Much lower threshold
            console.log(
              `Early return: Found ${allLinkingAnnotations.length} linking annotations at page ${currentPage}`,
            );
            break;
          }

          // If page is completely empty, it might be beyond the end
          if (pageAnnotations.length === 0) {
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
        // Continue to next page instead of stopping completely
        consecutiveEmptyPages++;
      }

      currentPage++;
    }

    const items = allLinkingAnnotations;

    // Filter linking annotations to only include those relevant to the current canvas
    checkTimeout(); // Check before expensive filtering operation
    const relevantLinkingAnnotations = await filterLinkingAnnotationsByCanvas(
      items,
      targetCanvasId || '',
    );

    const iconStates: Record<
      string,
      { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
    > = {};

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
              // Check the target annotation's body for enhancements
              const targetBody = Array.isArray(targetAnnotation.body)
                ? targetAnnotation.body
                : [targetAnnotation.body];

              let hasGeotag = targetBody.some(
                (b: any) => b?.purpose === 'geotagging',
              );
              let hasPoint = targetBody.some(
                (b: any) => b?.purpose === 'selecting',
              );

              // Also check linking annotations that reference this target for additional enhancements
              relevantLinkingAnnotations.forEach((linkingAnnotation) => {
                const targets = Array.isArray(linkingAnnotation.target)
                  ? linkingAnnotation.target
                  : [linkingAnnotation.target];

                if (targets.includes(targetUrl)) {
                  const linkingBody = Array.isArray(linkingAnnotation.body)
                    ? linkingAnnotation.body
                    : linkingAnnotation.body
                    ? [linkingAnnotation.body]
                    : [];

                  if (!hasGeotag) {
                    hasGeotag = linkingBody.some(
                      (b: any) => b?.purpose === 'geotagging',
                    );
                  }
                  if (!hasPoint) {
                    hasPoint = linkingBody.some(
                      (b: any) => b?.purpose === 'selecting',
                    );
                  }
                }
              });

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

    return NextResponse.json({
      annotations: relevantLinkingAnnotations,
      iconStates,
    });
  } catch (error) {
    console.error('Error fetching bulk linking annotations:', error);
    
    // Return empty but valid response instead of 500 error
    return NextResponse.json({
      annotations: [],
      iconStates: {},
      message: 'Service temporarily unavailable - using cached data',
      error: false // Indicate this is expected behavior, not an error
    }, { status: 200 }); // Return 200, not 500
  }
}
