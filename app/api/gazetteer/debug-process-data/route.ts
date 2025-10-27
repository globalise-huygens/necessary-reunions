import { processPlaceData } from '@/lib/gazetteer/data';
import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch first page of annotations
    const annoRepoUrl =
      'https://annorepo.globalise.huygens.knaw.nl/services/necessary-reunions/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==?page=0';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(annoRepoUrl, {
      headers: {
        Accept: '*/*',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({
        error: `Fetch failed: ${response.status}`,
      });
    }

    const data = await response.json();
    const annotations = (data.items || []).slice(0, 5);

    // Call the ACTUAL processPlaceData function
    const result = await processPlaceData({
      linking: annotations,
      geotagging: [],
    });

    return NextResponse.json({
      success: true,
      annotationCount: annotations.length,
      placeCount: result.places.length,
      totalAnnotations: result.totalAnnotations,
      processedAnnotations: result.processedAnnotations,
      truncated: result.truncated,
      warning: result.warning,
      samplePlace: result.places[0] || null,
    });
  } catch (error) {
    return NextResponse.json({
      error: String(error),
      stack: (error as Error).stack,
    });
  }
}
