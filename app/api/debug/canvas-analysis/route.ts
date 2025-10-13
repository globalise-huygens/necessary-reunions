import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Use a different approach - fetch from our own bulk API for a canvas that works
    // and extract the raw data to see what's actually in there

    const w37Response = await fetch(
      `http://localhost:3000/api/annotations/linking-bulk?targetCanvasId=${encodeURIComponent(
        'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1',
      )}`,
    );

    if (!w37Response.ok) {
      throw new Error(`Bulk API failed: ${w37Response.status}`);
    }

    const w37Data = await w37Response.json();
    const annotations = w37Data.annotations || [];

    // Analyze what canvas sources are referenced in these annotations
    const canvasSources = new Set<string>();
    const bodyAnalysis: any[] = [];

    annotations.forEach((annotation: any, index: number) => {
      if (!annotation.body) return;

      const bodies = Array.isArray(annotation.body)
        ? annotation.body
        : [annotation.body];

      bodies.forEach((bodyItem: any, bodyIndex: number) => {
        if (bodyItem.source) {
          canvasSources.add(bodyItem.source);

          // Keep first 10 examples for analysis
          if (bodyAnalysis.length < 10) {
            bodyAnalysis.push({
              annotationIndex: index,
              bodyIndex: bodyIndex,
              source: bodyItem.source,
              purpose: bodyItem.purpose,
              selector: bodyItem.selector?.type,
            });
          }
        }
      });
    });

    // Test a few other canvas IDs from the manifest
    const testResults: any = {};
    const testCanvases = [
      'https://data.globalise.huygens.knaw.nl/manifests/maps/4.VEL/C/C.2/C.2.4/cananore/891.json/canvas/p2',
      'https://data.globalise.huygens.knaw.nl/manifests/maps/4.VEL/C/C.2/C.2.4/cranganore/892.json/canvas/p1',
    ];

    for (const canvasId of testCanvases) {
      try {
        const testResponse = await fetch(
          `http://localhost:3000/api/annotations/linking-bulk?targetCanvasId=${encodeURIComponent(
            canvasId,
          )}`,
        );
        const testData = await testResponse.json();
        testResults[canvasId] = {
          annotations: testData.annotations?.length || 0,
          shortId: canvasId.split('/').slice(-2).join('/'),
        };
      } catch (error) {
        testResults[canvasId] = { error: String(error) };
      }
    }

    return NextResponse.json({
      w37CanvasData: {
        totalAnnotations: annotations.length,
        uniqueCanvasSources: Array.from(canvasSources).sort(),
        bodyExamples: bodyAnalysis,
      },
      otherCanvasTests: testResults,
      conclusion: 'Checking if the issue is canvas ID format mismatch',
    });
  } catch (error) {
    console.error('Error analyzing canvas data:', error);
    return NextResponse.json(
      { error: 'Failed to analyze canvas data', details: String(error) },
      { status: 500 },
    );
  }
}
