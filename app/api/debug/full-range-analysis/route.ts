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

    const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
    const CONTAINER = 'necessary-reunions';
    const endpoint = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}`;

    const headers: HeadersInit = {
      Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      Authorization: `Bearer ${ANNO_REPO_TOKEN}`,
    };

    let allLinkingAnnotations: any[] = [];
    const pageResults: any[] = [];

    // Search the complete range: pages 220-231
    for (let pageNum = 220; pageNum <= 231; pageNum++) {
      try {
        const pageUrl = `${endpoint}?page=${pageNum}`;
        const response = await fetch(pageUrl, { headers });

        if (response.ok) {
          const data = await response.json();
          const pageAnnotations = data.items || [];

          const linkingAnnotationsOnPage = pageAnnotations.filter(
            (annotation: any) => annotation.motivation === 'linking',
          );

          pageResults.push({
            page: pageNum,
            totalItems: pageAnnotations.length,
            linkingAnnotations: linkingAnnotationsOnPage.length,
          });

          allLinkingAnnotations.push(...linkingAnnotationsOnPage);
        } else {
          pageResults.push({
            page: pageNum,
            error: `${response.status} ${response.statusText}`,
          });
        }
      } catch (error) {
        pageResults.push({
          page: pageNum,
          error: String(error),
        });
      }
    }

    // Analyze canvas sources referenced by these linking annotations
    const canvasAnalysis = new Map<string, number>();
    let processedCount = 0;
    const maxToProcess = 10; // Process first 10 to avoid timeout

    for (const linkingAnnotation of allLinkingAnnotations.slice(
      0,
      maxToProcess,
    )) {
      if (
        !linkingAnnotation.target ||
        !Array.isArray(linkingAnnotation.target)
      ) {
        continue;
      }

      // Check first target to see what canvas it references
      const firstTarget = linkingAnnotation.target[0];
      if (firstTarget) {
        try {
          const targetResponse = await fetch(firstTarget, { headers });
          if (targetResponse.ok) {
            const targetData = await targetResponse.json();
            const canvasSource = targetData.target?.source;
            if (canvasSource && canvasSource.includes('canvas')) {
              canvasAnalysis.set(
                canvasSource,
                (canvasAnalysis.get(canvasSource) || 0) + 1,
              );
            }
            processedCount++;
          }
        } catch (error) {
          // Continue to next annotation
        }
      }
    }

    return NextResponse.json({
      totalLinkingAnnotations: allLinkingAnnotations.length,
      pageResults,
      canvasAnalysis: Object.fromEntries(
        Array.from(canvasAnalysis.entries()).sort(),
      ),
      samplingInfo: {
        processedAnnotations: processedCount,
        totalAnnotations: allLinkingAnnotations.length,
        maxProcessed: maxToProcess,
      },
      conclusion: {
        foundInPages: pageResults
          .filter((p) => p.linkingAnnotations > 0)
          .map((p) => p.page),
        totalPages: pageResults.length,
        averagePerPage:
          Math.round(
            (allLinkingAnnotations.length / pageResults.length) * 100,
          ) / 100,
      },
    });
  } catch (error) {
    console.error('Error in full range analysis:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze full range',
        details: String(error),
      },
      { status: 500 },
    );
  }
}
