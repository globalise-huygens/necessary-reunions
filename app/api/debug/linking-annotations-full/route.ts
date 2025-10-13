import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Direct query to AnnoRepo to get ALL linking annotations
    // This will help us see what canvas sources actually exist in the data

    const ANNO_REPO_TOKEN = process.env.ANNO_REPO_TOKEN_JONA;
    if (!ANNO_REPO_TOKEN) {
      return NextResponse.json(
        { error: 'AnnoRepo token not configured' },
        { status: 500 },
      );
    }

    // Query multiple pages from AnnoRepo to get ALL linking annotations
    // Based on the docs, annotations start from page 220 and go to page 230
    const annotations: any[] = [];
    let totalFetched = 0;

    // First check the custom query for current page
    const customQueryUrl =
      'https://annorepo.globalise.huygens.knaw.nl/services/necessary-reunions/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      // Fetch from custom query first
      const response = await fetch(customQueryUrl, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${ANNO_REPO_TOKEN}`,
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        annotations.push(...(data.items || []));
        totalFetched += data.items?.length || 0;
      }

      // Also check a few specific pages mentioned in the docs
      const pagesToCheck = [220, 225, 230];
      for (const page of pagesToCheck) {
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
            // Filter for linking annotations only
            const linkingAnnotations = (pageData.items || []).filter(
              (item: any) =>
                item.motivation === 'linking' ||
                (Array.isArray(item.motivation) &&
                  item.motivation.includes('linking')),
            );
            annotations.push(...linkingAnnotations);
            totalFetched += linkingAnnotations.length;
          }
        } catch (pageError) {
          console.warn(`Could not fetch page ${page}:`, pageError);
        }
      }

      clearTimeout(timeoutId);

      // Analyze all canvas sources referenced in the linking annotations
      const canvasSourcesAnalysis = new Map<
        string,
        {
          count: number;
          examples: any[];
          collection: string;
          map: string;
        }
      >();

      const manifestPatterns = new Set<string>();
      const bodyPurposes = new Map<string, number>();

      annotations.forEach((annotation: any, index: number) => {
        if (!annotation.body) return;

        const bodies = Array.isArray(annotation.body)
          ? annotation.body
          : [annotation.body];

        bodies.forEach((bodyItem: any) => {
          if (bodyItem.source && typeof bodyItem.source === 'string') {
            const source = bodyItem.source;

            // Track purposes
            if (bodyItem.purpose) {
              bodyPurposes.set(
                bodyItem.purpose,
                (bodyPurposes.get(bodyItem.purpose) || 0) + 1,
              );
            }

            // Only analyze canvas sources (not place URIs)
            if (
              source.includes('data.globalise.huygens.knaw.nl') &&
              source.includes('canvas')
            ) {
              // Extract collection and map info
              const urlParts = source.split('/');
              const collectionIdx = urlParts.findIndex((part: string) =>
                ['4.MIKO', '4.VEL', '4.VELH'].includes(part),
              );
              const collection =
                collectionIdx >= 0 ? urlParts[collectionIdx] : 'unknown';

              // Look for map identifier patterns
              const mapPattern = source.match(/\/([^\/]+)\.json\/canvas/);
              const map = mapPattern ? mapPattern[1] : 'unknown';

              // Add to manifest patterns for comparison
              manifestPatterns.add(source);

              if (!canvasSourcesAnalysis.has(source)) {
                canvasSourcesAnalysis.set(source, {
                  count: 0,
                  examples: [],
                  collection,
                  map,
                });
              }

              const entry = canvasSourcesAnalysis.get(source)!;
              entry.count++;

              if (entry.examples.length < 3) {
                entry.examples.push({
                  annotationId: annotation.id,
                  bodyPurpose: bodyItem.purpose,
                  bodySelector: bodyItem.selector?.type,
                  annotationTarget: annotation.target,
                });
              }
            }
          }
        });
      });

      // Load manifest to compare canvas IDs
      let manifestCanvases: string[] = [];
      try {
        const manifestResponse = await fetch(
          'http://localhost:3000/api/manifest',
        );
        if (manifestResponse.ok) {
          const manifest = await manifestResponse.json();
          manifestCanvases = manifest.items?.map((item: any) => item.id) || [];
        }
      } catch (error) {
        console.warn('Could not load manifest for comparison:', error);
      }

      // Compare manifest canvas IDs with actual data
      const manifestAnalysis = {
        totalManifestCanvases: manifestCanvases.length,
        canvasesWithData: 0,
        canvasesWithoutData: [] as string[],
        manifestCanvases: manifestCanvases,
      };

      manifestCanvases.forEach((canvasId) => {
        if (canvasSourcesAnalysis.has(canvasId)) {
          manifestAnalysis.canvasesWithData++;
        } else {
          manifestAnalysis.canvasesWithoutData.push(canvasId);
        }
      });

      // Group by collection for easier analysis
      const byCollection = new Map<string, any[]>();
      canvasSourcesAnalysis.forEach((data, source) => {
        if (!byCollection.has(data.collection)) {
          byCollection.set(data.collection, []);
        }
        byCollection.get(data.collection)!.push({
          source,
          ...data,
        });
      });

      return NextResponse.json({
        summary: {
          totalLinkingAnnotations: annotations.length,
          totalFetched: totalFetched,
          uniqueCanvasSources: canvasSourcesAnalysis.size,
          bodyPurposes: Object.fromEntries(bodyPurposes),
          collections: Array.from(byCollection.keys()),
        },
        canvasSourcesByCollection: Object.fromEntries(byCollection),
        manifestComparison: manifestAnalysis,
        investigation: {
          message:
            'This shows all canvas sources referenced in linking annotations vs manifest canvas IDs',
          possibleIssues: [
            'Canvas ID format mismatches between manifest and annotation data',
            'Missing linking annotations for some maps in external service',
            'Different canvas numbering schemes (p1 vs p2, etc.)',
            'URL path differences between collections',
          ],
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error investigating linking annotations:', error);
    return NextResponse.json(
      {
        error: 'Failed to investigate linking annotations',
        details: String(error),
        suggestion:
          'Check if AnnoRepo service is accessible and authentication is working',
      },
      { status: 500 },
    );
  }
}
