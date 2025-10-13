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

    // Direct test of specific page that user mentioned
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const pageUrl =
        'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/?page=231';
      const pageResponse = await fetch(pageUrl, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${ANNO_REPO_TOKEN}`,
          Accept: 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!pageResponse.ok) {
        throw new Error(
          `Page 231 failed: ${pageResponse.status} ${pageResponse.statusText}`,
        );
      }

      const pageData = await pageResponse.json();
      const allItems = pageData.items || [];

      // Filter for linking annotations
      const linkingAnnotations = allItems.filter(
        (item: any) => item.motivation === 'linking',
      );

      // Analyze what these linking annotations reference
      const analysisResults: any[] = [];
      const canvasReferences = new Set<string>();

      for (const annotation of linkingAnnotations) {
        const analysis: any = {
          annotationId: annotation.id,
          created: annotation.created,
          creator: annotation.creator?.label || 'unknown',
          targets: Array.isArray(annotation.target)
            ? annotation.target
            : [annotation.target],
          targetCount: Array.isArray(annotation.target)
            ? annotation.target.length
            : 1,
          bodyCount: Array.isArray(annotation.body)
            ? annotation.body.length
            : annotation.body
            ? 1
            : 0,
        };

        // For each target annotation, try to fetch it and see what canvas it references
        const targetAnalysis: any[] = [];
        for (const targetId of analysis.targets.slice(0, 3)) {
          // Check first 3 targets
          try {
            const targetResponse = await fetch(targetId, {
              signal: controller.signal,
              headers: {
                Authorization: `Bearer ${ANNO_REPO_TOKEN}`,
                Accept: 'application/json',
              },
            });

            if (targetResponse.ok) {
              const targetData = await targetResponse.json();
              const canvasSource = targetData.target?.source;
              if (canvasSource && canvasSource.includes('canvas')) {
                canvasReferences.add(canvasSource);
                targetAnalysis.push({
                  targetId,
                  canvasSource,
                  motivation: targetData.motivation,
                });
              }
            }
          } catch (error) {
            console.warn(`Could not fetch target ${targetId}:`, error);
          }
        }

        analysis.targetCanvases = targetAnalysis;
        analysisResults.push(analysis);
      }

      // Check what pages we should be searching
      const paginationInfo = {
        currentPage: pageData.page || 231,
        totalItems: pageData.total || 'unknown',
        lastPage: pageData.last || 'unknown',
      };

      return NextResponse.json({
        page231Analysis: {
          totalItems: allItems.length,
          linkingAnnotations: linkingAnnotations.length,
          otherAnnotations: allItems.length - linkingAnnotations.length,
          canvasesReferenced: Array.from(canvasReferences).sort(),
          linkingDetails: analysisResults,
        },
        pagination: paginationInfo,
        conclusion: {
          issue:
            'Found linking annotations on page 231 that reference canvas sources',
          canvasCount: canvasReferences.size,
          recommendation:
            'Update the bulk API to search higher page numbers or use correct custom query',
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error analyzing page 231:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze page 231',
        details: String(error),
      },
      { status: 500 },
    );
  }
}
