import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const ANNO_REPO_TOKEN = process.env.ANNO_REPO_TOKEN_JONA;
    if (!ANNO_REPO_TOKEN) {
      return NextResponse.json(
        { error: 'AnnoRepo token not configured' },
        { status: 500 },
      );
    }

    // Load manifest canvases
    let manifestCanvases: string[] = [];
    try {
      const manifestResponse = await fetch(
        'https://globalise-huygens.github.io/necessary-reunions/manifest.json',
      );
      if (manifestResponse.ok) {
        const manifest = await manifestResponse.json();
        manifestCanvases = manifest.items?.map((item: any) => item.id) || [];
      }
    } catch (error) {
      console.warn('Could not load manifest:', error);
    }

    const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
    const CONTAINER = 'necessary-reunions';
    const endpoint = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}`;

    const headers: HeadersInit = {
      Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      Authorization: `Bearer ${ANNO_REPO_TOKEN}`,
    };

    // Dynamic search: find the actual range of pages with linking annotations
    let allLinkingAnnotations: any[] = [];
    const pageResults: any[] = [];
    let lastPageWithContent = 0;

    // Start from page 220 and search until we find no more linking annotations
    for (let pageNum = 220; pageNum <= 350; pageNum++) {
      try {
        const pageUrl = `${endpoint}?page=${pageNum}`;
        const response = await fetch(pageUrl, { headers });

        if (response.ok) {
          const data = await response.json();
          const pageAnnotations = data.items || [];

          if (pageAnnotations.length === 0) {
            // Empty page - we might have reached the end
            if (pageNum > lastPageWithContent + 5) {
              console.log(
                `Stopping search at page ${pageNum} - no content for 5+ pages`,
              );
              break;
            }
          } else {
            lastPageWithContent = pageNum;
          }

          const linkingAnnotationsOnPage = pageAnnotations.filter(
            (annotation: any) => annotation.motivation === 'linking',
          );

          if (linkingAnnotationsOnPage.length > 0) {
            pageResults.push({
              page: pageNum,
              totalItems: pageAnnotations.length,
              linkingAnnotations: linkingAnnotationsOnPage.length,
            });

            allLinkingAnnotations.push(...linkingAnnotationsOnPage);
          }
        } else if (response.status === 404) {
          // 404 means we've gone beyond available pages
          console.log(`Reached end of pages at ${pageNum} (404)`);
          break;
        }
      } catch (error) {
        console.warn(`Error fetching page ${pageNum}:`, error);
        continue;
      }

      // Stop if we've found a lot of annotations to prevent timeout
      if (allLinkingAnnotations.length > 1000) {
        console.log(
          `Stopping search - found ${allLinkingAnnotations.length} annotations`,
        );
        break;
      }
    }

    // Now analyze which canvases these linking annotations actually reference
    const canvasMapping = new Map<string, number>();
    const unmappedAnnotations: any[] = [];
    let processedCount = 0;
    const maxToAnalyze = Math.min(436, allLinkingAnnotations.length); // Analyze ALL annotations

    for (const linkingAnnotation of allLinkingAnnotations.slice(
      0,
      maxToAnalyze,
    )) {
      if (
        !linkingAnnotation.target ||
        !Array.isArray(linkingAnnotation.target)
      ) {
        unmappedAnnotations.push({
          id: linkingAnnotation.id,
          reason: 'No valid target array',
        });
        continue;
      }

      // Check first target to see what canvas it references
      const firstTarget = linkingAnnotation.target[0];
      if (firstTarget) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);

          const targetResponse = await fetch(firstTarget, {
            headers,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (targetResponse.ok) {
            const targetData = await targetResponse.json();
            const canvasSource = targetData.target?.source;

            if (canvasSource && canvasSource.includes('canvas')) {
              canvasMapping.set(
                canvasSource,
                (canvasMapping.get(canvasSource) || 0) + 1,
              );
            } else {
              unmappedAnnotations.push({
                id: linkingAnnotation.id,
                reason: 'Target has no canvas source',
                targetData: {
                  motivation: targetData.motivation,
                  hasTarget: !!targetData.target,
                  targetSource: targetData.target?.source,
                },
              });
            }
            processedCount++;
          } else {
            unmappedAnnotations.push({
              id: linkingAnnotation.id,
              reason: `Target fetch failed: ${targetResponse.status}`,
            });
          }
        } catch (error) {
          unmappedAnnotations.push({
            id: linkingAnnotation.id,
            reason: `Target fetch error: ${String(error)}`,
          });
        }
      }
    }

    // Compare with manifest canvases
    const manifestAnalysis = new Map<
      string,
      {
        inManifest: boolean;
        linkingAnnotationCount: number;
      }
    >();

    // Initialize all manifest canvases
    manifestCanvases.forEach((canvasId) => {
      manifestAnalysis.set(canvasId, {
        inManifest: true,
        linkingAnnotationCount: canvasMapping.get(canvasId) || 0,
      });
    });

    // Add non-manifest canvases found in linking annotations
    canvasMapping.forEach((count, canvasId) => {
      if (!manifestAnalysis.has(canvasId)) {
        manifestAnalysis.set(canvasId, {
          inManifest: false,
          linkingAnnotationCount: count,
        });
      }
    });

    // Summary statistics
    const manifestCanvasesWithAnnotations = Array.from(
      manifestAnalysis.entries(),
    ).filter(
      ([_, data]) => data.inManifest && data.linkingAnnotationCount > 0,
    ).length;

    const nonManifestCanvasesWithAnnotations = Array.from(
      manifestAnalysis.entries(),
    ).filter(
      ([_, data]) => !data.inManifest && data.linkingAnnotationCount > 0,
    ).length;

    const totalMappedAnnotations = Array.from(canvasMapping.values()).reduce(
      (sum, count) => sum + count,
      0,
    );

    return NextResponse.json({
      discoveryResults: {
        totalLinkingAnnotations: allLinkingAnnotations.length,
        searchRange: `pages ${pageResults[0]?.page || 'none'}-${
          pageResults[pageResults.length - 1]?.page || 'none'
        }`,
        pagesWithLinkingAnnotations: pageResults.length,
        pageResults: pageResults.slice(0, 10), // Show first 10 pages
      },
      canvasAnalysis: {
        manifestCanvasCount: manifestCanvases.length,
        processedAnnotations: processedCount,
        totalMappedAnnotations,
        manifestCanvasesWithAnnotations,
        nonManifestCanvasesWithAnnotations,
        unmappedAnnotations: unmappedAnnotations.length,
      },
      canvasMapping: Object.fromEntries(
        Array.from(canvasMapping.entries())
          .sort(([_, a], [__, b]) => b - a) // Sort by annotation count desc
          .slice(0, 20), // Show top 20
      ),
      manifestComparison: Object.fromEntries(
        Array.from(manifestAnalysis.entries())
          .filter(([_, data]) => data.linkingAnnotationCount > 0)
          .sort(
            ([_, a], [__, b]) =>
              b.linkingAnnotationCount - a.linkingAnnotationCount,
          )
          .slice(0, 20),
      ),
      issues: {
        unmappedSample: unmappedAnnotations.slice(0, 5),
        missingFromManifest: Array.from(canvasMapping.keys())
          .filter((canvasId) => !manifestCanvases.includes(canvasId))
          .slice(0, 10),
      },
    });
  } catch (error) {
    console.error('Error in comprehensive canvas analysis:', error);
    return NextResponse.json(
      {
        error: 'Failed to perform comprehensive analysis',
        details: String(error),
      },
      { status: 500 },
    );
  }
}
