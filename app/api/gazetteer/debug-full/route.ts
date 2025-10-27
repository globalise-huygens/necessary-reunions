import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

interface DebugFullResponse {
  success?: boolean;
  annotationCount?: number;
  targetCount?: number;
  sampleTarget?: unknown;
  error?: string;
}

export async function GET(): Promise<NextResponse<DebugFullResponse>> {
  try {
    // Fetch annotations
    const annoRepoUrl =
      'https://annorepo.globalise.huygens.knaw.nl/services/necessary-reunions/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==?page=0';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(annoRepoUrl, {
        headers: {
          Accept:
            'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return NextResponse.json({
          error: `AnnoRepo error: ${response.status}`,
        });
      }

      const data = (await response.json()) as {
        items?: Array<{
          id?: string;
          body?: unknown[];
          target?: unknown[];
        }>;
      };
      const annotations = data.items || [];

      // Test fetching the FIRST target from the FIRST annotation
      const firstAnnotation = annotations[0];
      if (!firstAnnotation || !Array.isArray(firstAnnotation.target)) {
        return NextResponse.json({
          error: 'No annotations with targets found',
          annotationCount: annotations.length,
        });
      }

      const firstTarget = firstAnnotation.target[0];
      const firstTargetUrl =
        typeof firstTarget === 'string'
          ? firstTarget
          : (firstTarget as { id?: string; source?: string }).id ||
            (firstTarget as { id?: string; source?: string }).source;

      if (!firstTargetUrl || typeof firstTargetUrl !== 'string') {
        return NextResponse.json({
          error: 'Cannot extract target URL',
          annotation: firstAnnotation,
        });
      }

      // Try fetching the target
      const targetController = new AbortController();
      const targetTimeoutId = setTimeout(() => targetController.abort(), 8000);

      try {
        const targetResponse = await fetch(firstTargetUrl, {
          headers: {
            Accept:
              'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
          },
          signal: targetController.signal,
        });

        clearTimeout(targetTimeoutId);

        if (!targetResponse.ok) {
          return NextResponse.json({
            success: false,
            error: `Target fetch failed: ${targetResponse.status}`,
            targetUrl: firstTargetUrl,
          });
        }

        const targetData = (await targetResponse.json()) as {
          motivation?: string;
          body?: unknown[];
        };

        return NextResponse.json({
          success: true,
          annotationCount: annotations.length,
          firstAnnotation: {
            id: firstAnnotation.id,
            targetCount: Array.isArray(firstAnnotation.target)
              ? firstAnnotation.target.length
              : 0,
            bodyCount: Array.isArray(firstAnnotation.body)
              ? firstAnnotation.body.length
              : 0,
          },
          targetFetch: {
            url: firstTargetUrl,
            success: true,
            motivation: targetData.motivation,
            bodyCount: Array.isArray(targetData.body)
              ? targetData.body.length
              : 0,
          },
        });
      } catch (targetError) {
        clearTimeout(targetTimeoutId);

        return NextResponse.json({
          success: false,
          error: 'Target fetch error',
          targetUrl: firstTargetUrl,
          errorName: (targetError as Error).name,
          errorMessage: (targetError as Error).message,
        });
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === 'AbortError') {
        return NextResponse.json({
          error: 'Request timeout',
        });
      }

      throw error;
    }
  } catch (error) {
    return NextResponse.json({
      error: String(error),
    });
  }
}
