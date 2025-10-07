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

    // Load manifest canvases for comparison
    const manifestCanvases: string[] = [];
    try {
      const fs = require('fs');
      const manifestPath =
        '/Users/neru/projects/necessary-reunions/data/manifest.json';
      const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifestCanvases.push(
        ...(manifestData.items?.map((item: any) => item.id) || []),
      );
    } catch (error) {
      console.warn('Could not load manifest:', error);
    }

    // Group manifest canvases by collection for analysis
    const manifestByCollection = new Map<string, string[]>();
    manifestCanvases.forEach((canvasId) => {
      const match = canvasId.match(/\/(4\.[A-Z]+)\//);
      const collection = match ? match[1] : 'unknown';
      if (!manifestByCollection.has(collection)) {
        manifestByCollection.set(collection, []);
      }
      manifestByCollection.get(collection)!.push(canvasId);
    });

    // Search for linking annotations in bulk container pages
    const allLinkingAnnotations: any[] = [];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      // Expand search range - user found linking annotations on page 231
      // Let's check a wider range to find all linking annotations
      for (let page = 220; page <= 240; page++) {
        try {
          const pageUrl = `https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/?page=${page}`;
          const pageResponse = await fetch(pageUrl, {
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${ANNO_REPO_TOKEN}`,
              Accept: 'application/json',
            },
          });

          if (pageResponse.ok) {
            const pageData = await pageResponse.json();
            const linkingAnnotations = (pageData.items || []).filter(
              (item: any) =>
                item.motivation === 'linking' ||
                (Array.isArray(item.motivation) &&
                  item.motivation.includes('linking')),
            );

            if (linkingAnnotations.length > 0) {
              allLinkingAnnotations.push(...linkingAnnotations);
              console.log(
                `Page ${page}: Found ${linkingAnnotations.length} linking annotations`,
              );
            }
          }
        } catch (pageError) {
          console.warn(`Could not fetch page ${page}:`, pageError);
        }
      }

      clearTimeout(timeoutId);

      // Analyze canvas sources from all found linking annotations
      const canvasSourcesByCollection = new Map<string, Set<string>>();
      const canvasAnnotationCount = new Map<string, number>();
      const annotationExamples = new Map<string, any[]>();

      allLinkingAnnotations.forEach((annotation) => {
        if (!annotation.body) return;

        const bodies = Array.isArray(annotation.body)
          ? annotation.body
          : [annotation.body];

        bodies.forEach((bodyItem: any) => {
          if (bodyItem.source && typeof bodyItem.source === 'string') {
            const source = bodyItem.source;

            // Only analyze canvas sources
            if (
              source.includes('data.globalise.huygens.knaw.nl') &&
              source.includes('canvas')
            ) {
              const match = source.match(/\/(4\.[A-Z]+)\//);
              const collection = match ? match[1] : 'unknown';

              if (!canvasSourcesByCollection.has(collection)) {
                canvasSourcesByCollection.set(collection, new Set());
              }
              canvasSourcesByCollection.get(collection)!.add(source);

              canvasAnnotationCount.set(
                source,
                (canvasAnnotationCount.get(source) || 0) + 1,
              );

              if (!annotationExamples.has(source)) {
                annotationExamples.set(source, []);
              }
              if (annotationExamples.get(source)!.length < 2) {
                annotationExamples.get(source)!.push({
                  annotationId: annotation.id,
                  bodyPurpose: bodyItem.purpose,
                  target: annotation.target,
                });
              }
            }
          }
        });
      });

      // Check which manifest canvases have linking annotations
      const coverage = new Map<
        string,
        {
          manifestCanvases: number;
          canvasesWithAnnotations: number;
          missingCanvases: string[];
          foundCanvases: string[];
        }
      >();

      manifestByCollection.forEach((canvases, collection) => {
        const sourcesInCollection =
          canvasSourcesByCollection.get(collection) || new Set();
        const missingCanvases: string[] = [];
        const foundCanvases: string[] = [];

        canvases.forEach((canvasId) => {
          if (sourcesInCollection.has(canvasId)) {
            foundCanvases.push(canvasId);
          } else {
            missingCanvases.push(canvasId);
          }
        });

        coverage.set(collection, {
          manifestCanvases: canvases.length,
          canvasesWithAnnotations: foundCanvases.length,
          missingCanvases,
          foundCanvases,
        });
      });

      return NextResponse.json({
        summary: {
          totalLinkingAnnotations: allLinkingAnnotations.length,
          pagesSearched: '220-240',
          manifestCanvases: manifestCanvases.length,
          collectionsInManifest: Array.from(manifestByCollection.keys()),
          collectionsWithAnnotations: Array.from(
            canvasSourcesByCollection.keys(),
          ),
        },
        coverageByCollection: Object.fromEntries(coverage),
        detailedFindings: {
          canvasesWithAnnotations: Object.fromEntries(
            Array.from(canvasAnnotationCount.entries()).map(
              ([canvas, count]) => [
                canvas,
                {
                  annotationCount: count,
                  examples: annotationExamples.get(canvas) || [],
                },
              ],
            ),
          ),
        },
        conclusion: {
          issue:
            allLinkingAnnotations.length === 0
              ? 'No linking annotations found in the searched pages'
              : 'Limited linking annotation coverage',
          recommendation:
            'Check if linking annotations for VEL/VELH collections exist in different pages or need to be uploaded to AnnoRepo',
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error searching for linking annotations:', error);
    return NextResponse.json(
      {
        error: 'Failed to search for linking annotations',
        details: String(error),
      },
      { status: 500 },
    );
  }
}
