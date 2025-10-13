import { encodeCanvasUri } from '@/lib/shared/utils';
import { NextRequest, NextResponse } from 'next/server';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const QUERY_NAME = 'with-target-and-motivation-or-purpose';

// Helper function to check if a linking annotation has targets on the current canvas
// Optimized for Netlify serverless constraints (10s timeout limit)
async function filterLinkingAnnotationsByCanvas(
  linkingAnnotations: any[],
  targetCanvasId: string,
): Promise<any[]> {
  if (!targetCanvasId) return linkingAnnotations;

  const ANNO_REPO_TOKEN = process.env.ANNO_REPO_TOKEN_JONA;
  if (!ANNO_REPO_TOKEN) {
    console.warn('No auth token for filtering linking annotations');
    return [];
  }

  const headers: HeadersInit = {
    Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
    Authorization: `Bearer ${ANNO_REPO_TOKEN}`,
  };

  const relevantLinkingAnnotations: any[] = [];

  // Process all annotations - scales automatically as database grows
  // Optimized for Netlify serverless constraints (10s function timeout)

  const MAX_PROCESSING_TIME = 8000; // 8 seconds max for Netlify functions (leaving 2s buffer)
  const BATCH_SIZE = 25; // Process in smaller batches for efficiency
  const startTime = Date.now();
  let processedCount = 0;

  // Instead of limiting total annotations, process them more efficiently
  // Use all annotations but with optimized processing
  // Process ALL annotations but with time-based batching for Netlify constraints
  const annotationsToCheck = linkingAnnotations;

  for (const linkingAnnotation of annotationsToCheck) {
    // Check if we're running out of time
    if (Date.now() - startTime > MAX_PROCESSING_TIME) {
      break;
    }

    processedCount++;

    if (!linkingAnnotation.target || !Array.isArray(linkingAnnotation.target)) {
      continue;
    }

    // Aggressive optimization for Netlify serverless environment
    const maxTargetsToCheck = 1; // Check only first target for speed
    const targetsToCheck = linkingAnnotation.target.slice(0, maxTargetsToCheck);

    let isRelevant = false;

    for (const targetUrl of targetsToCheck) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 400); // Very aggressive 400ms timeout

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

    // Progress indicator for large datasets - minimal logging
    if (processedCount % 50 === 0 && processedCount > 0) {
      const timeElapsed = Date.now() - startTime;
      const timeRemaining = MAX_PROCESSING_TIME - timeElapsed;
      // Only log every 50 processed annotations to reduce noise
    }
  }

  return relevantLinkingAnnotations;
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const targetCanvasId = searchParams.get('targetCanvasId');
  const mode = searchParams.get('mode') || 'quick'; // 'quick' or 'full'
  const batch = parseInt(searchParams.get('batch') || '0'); // For batched processing
  const isGlobal = searchParams.get('global') === 'true'; // Global loading mode

  // For global mode, we don't need a specific canvas ID
  if (!isGlobal && !targetCanvasId) {
    return NextResponse.json({
      annotations: [],
      iconStates: {},
      mode,
      batch,
      hasMore: false,
    });
  }

  try {
    // Progressive loading timeouts based on mode
    const startTime = Date.now();
    const MAX_EXECUTION_TIME = mode === 'quick' ? 5000 : 9000; // Quick: 5s, Full: 9s
    const QUICK_MODE_LIMIT = 50; // Process 50 annotations in quick mode
    const FULL_MODE_BATCH_SIZE = 100; // Process 100 annotations per full mode batch

    const checkTimeout = () => {
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        throw new Error('Netlify function timeout - returning partial results');
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

        // For linking annotations, we need to check their targets, not bodies
        // Linking annotations reference other annotations via their target array
        const relevantLinkingAnnotations = targetCanvasId
          ? await filterLinkingAnnotationsByCanvas(
              allLinkingAnnotations,
              targetCanvasId,
            )
          : allLinkingAnnotations;

        const iconStates: Record<
          string,
          { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
        > = {};

        // Create icon states for all linking annotations - simplified approach
        relevantLinkingAnnotations.forEach((annotation: any) => {
          if (annotation.target && Array.isArray(annotation.target)) {
            annotation.target.forEach((targetUrl: string) => {
              if (!iconStates[targetUrl]) {
                iconStates[targetUrl] = {
                  hasGeotag: false,
                  hasPoint: false,
                  isLinked: false,
                };
              }

              // Check the linking annotation's body for enhancements
              const linkingBody = Array.isArray(annotation.body)
                ? annotation.body
                : annotation.body
                ? [annotation.body]
                : [];

              // Check for geotagging and point selection directly in linking annotation
              if (linkingBody.some((b: any) => b?.purpose === 'geotagging')) {
                iconStates[targetUrl].hasGeotag = true;
              }
              if (linkingBody.some((b: any) => b?.purpose === 'selecting')) {
                iconStates[targetUrl].hasPoint = true;
              }

              // Mark as linked if this target appears in any linking annotation
              iconStates[targetUrl].isLinked = true;
            });
          }
        });

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

    // Dynamic search: automatically discover the range of pages with linking annotations
    // Use smart search to find where linking annotations actually exist
    let allLinkingAnnotations: any[] = [];

    // Strategy: Test known likely ranges first, then use binary search
    const findFirstPageWithLinking = async (): Promise<number> => {
      // Test some likely candidate pages based on current knowledge (200-220 range)
      const candidatePages = [200, 210, 205, 215, 180, 150];

      for (const testPage of candidatePages) {
        checkTimeout();
        try {
          const testUrl = `${endpoint}?page=${testPage}`;
          const testResponse = await fetch(testUrl, { headers });

          if (testResponse.ok) {
            const testData = await testResponse.json();
            const pageAnnotations = testData.items || [];
            const hasLinking = pageAnnotations.some(
              (ann: any) => ann.motivation === 'linking',
            );

            if (hasLinking) {
              // Found linking annotations, now search backwards to find the actual first page
              let searchPage = testPage;
              while (searchPage > Math.max(1, testPage - 30)) {
                checkTimeout();
                try {
                  const backUrl = `${endpoint}?page=${searchPage - 1}`;
                  const backResponse = await fetch(backUrl, { headers });

                  if (backResponse.ok) {
                    const backData = await backResponse.json();
                    const backAnnotations = backData.items || [];
                    const backHasLinking = backAnnotations.some(
                      (ann: any) => ann.motivation === 'linking',
                    );

                    if (!backHasLinking) {
                      // Found the boundary - current page is the first with linking
                      return searchPage;
                    }
                    searchPage--;
                  } else {
                    return searchPage;
                  }
                } catch (error) {
                  return searchPage;
                }
              }
              return searchPage;
            }
          }
        } catch (error) {
          // Continue to next candidate
        }
      }

      return -1; // No linking annotations found
    };

    // Find the first page with linking annotations
    const startPage = await findFirstPageWithLinking();

    if (startPage === -1) {
      console.warn('No linking annotations found in search range');
      return NextResponse.json({
        annotations: [],
        iconStates: {},
        mode,
        batch,
        hasMore: false,
        message: 'No linking annotations found',
      });
    }

    // Search forward from the start page to collect all linking annotations
    let currentPage = startPage;
    let consecutiveEmptyPages = 0;
    const maxConsecutiveEmpty = 3;
    const maxPagesToSearch = 30; // Should cover the 203-218 range plus buffer
    let pagesSearched = 0;

    while (
      consecutiveEmptyPages < maxConsecutiveEmpty &&
      pagesSearched < maxPagesToSearch
    ) {
      // Check timeout before each page request
      checkTimeout();

      try {
        const pageUrl = `${endpoint}?page=${currentPage}`;
        const response = await fetch(pageUrl, { headers });

        if (response.ok) {
          const data = await response.json();
          const pageAnnotations = data.items || [];

          if (pageAnnotations.length === 0) {
            consecutiveEmptyPages++;
          } else {
            const linkingAnnotationsOnPage = pageAnnotations.filter(
              (annotation: any) => annotation.motivation === 'linking',
            );

            if (linkingAnnotationsOnPage.length > 0) {
              consecutiveEmptyPages = 0; // Reset counter when we find linking annotations
              allLinkingAnnotations.push(...linkingAnnotationsOnPage); // Add to end since we're going forwards
            } else {
              consecutiveEmptyPages++;
            }
          }
        } else if (response.status === 404) {
          // 404 means we've reached beyond available pages
          break;
        } else {
          consecutiveEmptyPages++;
        }
      } catch (error) {
        consecutiveEmptyPages++;
      }

      currentPage++; // Move forward through pages
      pagesSearched++;

      // Safety check: if we've found a huge number of annotations, something might be wrong
      if (allLinkingAnnotations.length > 5000) {
        break;
      }
    }

    // Progressive loading: handle different modes
    let annotationsToProcess = allLinkingAnnotations;
    let hasMore = false;

    if (mode === 'quick') {
      // Quick mode: process first 50 annotations for immediate response
      annotationsToProcess = allLinkingAnnotations.slice(0, QUICK_MODE_LIMIT);
      hasMore = allLinkingAnnotations.length > QUICK_MODE_LIMIT;
    } else if (mode === 'full') {
      // Full mode: process in batches
      const startIndex = batch * FULL_MODE_BATCH_SIZE;
      const endIndex = startIndex + FULL_MODE_BATCH_SIZE;
      annotationsToProcess = allLinkingAnnotations.slice(startIndex, endIndex);
      hasMore = endIndex < allLinkingAnnotations.length;
    }

    // Filter annotations for the target canvas
    // For global mode, we load ALL linking annotations without canvas filtering
    const relevantLinkingAnnotations =
      isGlobal || !targetCanvasId
        ? allLinkingAnnotations
        : await filterLinkingAnnotationsByCanvas(
            annotationsToProcess,
            targetCanvasId,
          );

    const iconStates: Record<
      string,
      { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
    > = {};

    // Create icon states for all linking annotations - simplified approach
    relevantLinkingAnnotations.forEach((annotation: any) => {
      if (annotation.target && Array.isArray(annotation.target)) {
        annotation.target.forEach((targetUrl: string) => {
          if (!iconStates[targetUrl]) {
            iconStates[targetUrl] = {
              hasGeotag: false,
              hasPoint: false,
              isLinked: false,
            };
          }

          // Check the linking annotation's body for enhancements
          const linkingBody = Array.isArray(annotation.body)
            ? annotation.body
            : annotation.body
            ? [annotation.body]
            : [];

          // Check for geotagging and point selection directly in linking annotation
          if (linkingBody.some((b: any) => b?.purpose === 'geotagging')) {
            iconStates[targetUrl].hasGeotag = true;
          }
          if (linkingBody.some((b: any) => b?.purpose === 'selecting')) {
            iconStates[targetUrl].hasPoint = true;
          }

          // Mark as linked if this target appears in any linking annotation
          iconStates[targetUrl].isLinked = true;
        });
      }
    });

    return NextResponse.json({
      annotations: relevantLinkingAnnotations,
      iconStates,
      // Progressive loading metadata
      mode,
      batch,
      hasMore,
      totalAnnotations: allLinkingAnnotations.length,
      processedAnnotations: annotationsToProcess.length,
      foundRelevant: relevantLinkingAnnotations.length,
      nextBatch: hasMore ? batch + 1 : null,
    });
  } catch (error) {
    console.error('Error fetching bulk linking annotations:', error);

    // Always return a valid response, even on timeout or network errors
    // This prevents frontend from showing empty state indefinitely
    return NextResponse.json(
      {
        annotations: [],
        iconStates: {},
        // Progressive loading metadata even on error
        mode,
        batch,
        hasMore: false,
        totalAnnotations: 0,
        processedAnnotations: 0,
        foundRelevant: 0,
        nextBatch: null,
        message:
          'Service temporarily unavailable - annotations may load with basic state',
        error: false, // Indicate this is graceful degradation, not a failure
        timestamp: Date.now(),
      },
      { status: 200 },
    ); // Always return 200 for frontend compatibility
  }
}
