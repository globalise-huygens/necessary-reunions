import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Simplified version of the gazetteer data processing to debug
export async function GET() {
  const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
  const CONTAINER = 'necessary-reunions';
  const REQUEST_TIMEOUT = 3000;

  try {
    // Fetch first page of linking annotations
    const customQueryUrl = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(customQueryUrl, {
      headers: {
        Accept: '*/*',
        'Cache-Control': 'no-cache',
        'User-Agent': 'curl/8.7.1',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({
        error: `HTTP ${response.status}`,
        fetchWorks: false,
      });
    }

    const result = await response.json();
    const annotations = result.items || [];

    // Analyze annotations
    const geotaggedCount = annotations.filter((a: any) =>
      a.body?.some((b: any) => b.purpose === 'geotagging'),
    ).length;
    const textOnlyCount = annotations.length - geotaggedCount;

    // Sample first 3 annotations
    const sampleAnnotations = annotations.slice(0, 3).map((a: any) => ({
      id: a.id,
      hasBody: !!a.body,
      bodyCount: Array.isArray(a.body) ? a.body.length : 0,
      bodyPurposes: Array.isArray(a.body)
        ? a.body.map((b: any) => b.purpose)
        : [],
      targetCount: Array.isArray(a.target) ? a.target.length : 0,
      sampleTarget: Array.isArray(a.target) ? a.target[0] : null,
    }));

    // Try fetching first target annotation
    let targetFetchTest = null;
    if (annotations.length > 0) {
      const firstAnnotation = annotations[0];
      if (
        Array.isArray(firstAnnotation.target) &&
        firstAnnotation.target.length > 0
      ) {
        const targetUrl = firstAnnotation.target[0];

        const targetController = new AbortController();
        const targetTimeoutId = setTimeout(
          () => targetController.abort(),
          8000,
        );

        try {
          const targetResponse = await fetch(targetUrl, {
            headers: {
              Accept:
                'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
            },
            signal: targetController.signal,
          });

          clearTimeout(targetTimeoutId);

          targetFetchTest = {
            url: targetUrl,
            success: targetResponse.ok,
            status: targetResponse.status,
            data: targetResponse.ok ? await targetResponse.json() : null,
          };
        } catch (error) {
          clearTimeout(targetTimeoutId);
          targetFetchTest = {
            url: targetUrl,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    }

    return NextResponse.json({
      fetchWorks: true,
      annotationCount: annotations.length,
      geotaggedCount,
      textOnlyCount,
      hasMore: !!result.next,
      sampleAnnotations,
      targetFetchTest,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
      fetchWorks: false,
    });
  }
}
