import { NextRequest, NextResponse } from 'next/server';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

// This endpoint pre-processes ALL linking annotations and stores them by canvas
// It can be called periodically (e.g., daily) to refresh the cache
export async function POST(request: NextRequest) {
  const authToken = process.env.ANNO_REPO_TOKEN_JONA;
  if (!authToken) {
    return NextResponse.json(
      { error: 'No auth token available' },
      { status: 401 },
    );
  }

  const headers: HeadersInit = {
    Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
    Authorization: `Bearer ${authToken}`,
  };

  try {
    const startTime = Date.now();
    // Get ALL linking annotations (this can take longer since it's a background process)
    let allLinkingAnnotations: any[] = [];
    let currentPage = 220;
    let consecutiveEmptyPages = 0;
    const maxConsecutiveEmpty = 5;
    const maxPagesToSearch = 50; // More pages since this is background processing

    const endpoint = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}`;

    while (
      consecutiveEmptyPages < maxConsecutiveEmpty &&
      currentPage - 220 < maxPagesToSearch
    ) {
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
              consecutiveEmptyPages = 0;
              allLinkingAnnotations.push(...linkingAnnotationsOnPage);
              } else {
              consecutiveEmptyPages++;
            }
          }
        } else if (response.status === 404) {
          break;
        }
      } catch (error) {
        console.warn(
          `[CACHE-BUILDER] Error fetching page ${currentPage}:`,
          error,
        );
        consecutiveEmptyPages++;
      }
      currentPage++;
    }

    // Now process all linking annotations to build canvas-specific caches
    const canvasCache: Record<
      string,
      {
        annotations: any[];
        iconStates: Record<
          string,
          { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
        >;
      }
    > = {};

    let processedCount = 0;
    for (const linkingAnnotation of allLinkingAnnotations) {
      if (
        !linkingAnnotation.target ||
        !Array.isArray(linkingAnnotation.target)
      ) {
        continue;
      }

      // Process each target to determine which canvas it belongs to
      for (const targetUrl of linkingAnnotation.target) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout for background processing

          const targetResponse = await fetch(targetUrl, {
            headers,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (targetResponse.ok) {
            const targetData = await targetResponse.json();
            const canvasId = targetData.target?.source;

            if (canvasId) {
              // Initialize canvas cache if needed
              if (!canvasCache[canvasId]) {
                canvasCache[canvasId] = {
                  annotations: [],
                  iconStates: {},
                };
              }

              // Add linking annotation to this canvas
              canvasCache[canvasId].annotations.push(linkingAnnotation);

              // Build icon states
              if (!canvasCache[canvasId].iconStates[targetUrl]) {
                canvasCache[canvasId].iconStates[targetUrl] = {
                  hasGeotag: false,
                  hasPoint: false,
                  isLinked: false,
                };
              }

              // Check linking annotation body for enhancements
              const linkingBody = Array.isArray(linkingAnnotation.body)
                ? linkingAnnotation.body
                : linkingAnnotation.body
                ? [linkingAnnotation.body]
                : [];

              if (linkingBody.some((b: any) => b?.purpose === 'geotagging')) {
                canvasCache[canvasId].iconStates[targetUrl].hasGeotag = true;
              }
              if (linkingBody.some((b: any) => b?.purpose === 'selecting')) {
                canvasCache[canvasId].iconStates[targetUrl].hasPoint = true;
              }
              canvasCache[canvasId].iconStates[targetUrl].isLinked = true;
            }
          }
        } catch (error) {
          // Skip failed requests
          continue;
        }
      }

      processedCount++;
      if (processedCount % 50 === 0) {
        }
    }

    const totalTime = Date.now() - startTime;
    const canvasCount = Object.keys(canvasCache).length;

    // Return cache statistics and sample data
    const cacheStats = Object.entries(canvasCache).map(([canvasId, data]) => ({
      canvasId,
      annotationCount: data.annotations.length,
      iconStateCount: Object.keys(data.iconStates).length,
    }));

    return NextResponse.json({
      success: true,
      totalTime,
      totalAnnotations: allLinkingAnnotations.length,
      totalCanvases: canvasCount,
      cacheStats,
      // TODO: Store canvasCache in a database or persistent cache
      message: 'Cache built successfully - implement persistent storage next',
    });
  } catch (error) {
    console.error('[CACHE-BUILDER] Error:', error);
    return NextResponse.json(
      { error: 'Cache building failed', details: error },
      { status: 500 },
    );
  }
}
