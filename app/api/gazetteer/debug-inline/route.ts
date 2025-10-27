import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

interface DebugInlineResponse {
  success: boolean;
  logs: string[];
  placesCreated?: number;
  error?: string;
}

// Capture logs
const logs: string[] = [];

function log(message: string) {
  logs.push(message);
  console.log(message);
}

export async function GET(): Promise<NextResponse<DebugInlineResponse>> {
  logs.length = 0;

  try {
    log('[Debug] Starting inline debug...');

    // Fetch first page of annotations
    const annoRepoUrl =
      'https://annorepo.globalise.huygens.knaw.nl/services/necessary-reunions/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==?page=0';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      log('[Debug] Fetching annotations...');
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
          success: false,
          error: `Fetch failed: ${response.status}`,
          logs,
        });
      }

      const data = (await response.json()) as { items?: unknown[] };
      const annotations = (Array.isArray(data.items) ? data.items : []).slice(
        0,
        5,
      ) as Array<{
        body?: Array<{ purpose?: string; source?: unknown }>;
        target?: unknown[];
      }>; // Just first 5 for testing

      log(`[Debug] Fetched ${annotations.length} annotations`);

      // Process each annotation
      let placesCreated = 0;
      const processingStartTime = Date.now();
      const REQUEST_TIMEOUT = 2000;

      for (let i = 0; i < annotations.length; i++) {
        const ann = annotations[i];
        if (!ann) continue;

        log(`[Debug] Processing annotation ${i + 1}/${annotations.length}`);

        if (
          !ann.target ||
          !Array.isArray(ann.target) ||
          ann.target.length === 0
        ) {
          log(`  - No targets, skipping`);
          continue;
        }

        log(`  - Has ${ann.target.length} targets`);

        // Check for geotagging body
        const hasGeotagging = Array.isArray(ann.body)
          ? ann.body.some((b) => b.purpose === 'geotagging')
          : false;
        log(`  - Has geotagging: ${hasGeotagging}`);

        if (hasGeotagging) {
          log(`  - Creating place from geotagging`);
          placesCreated++;
          continue;
        }

        // Text-only annotation - need to fetch targets
        log(`  - Text-only, fetching first target...`);

        const firstTargetRaw = ann.target[0];
        const targetObj = firstTargetRaw as { id?: string; source?: string };
        const firstTarget =
          typeof firstTargetRaw === 'string'
            ? firstTargetRaw
            : targetObj.id || targetObj.source;

        if (!firstTarget || typeof firstTarget !== 'string') {
          log(`  - Cannot extract target URL`);
          continue;
        }

        const targetController = new AbortController();
        const targetTimeoutId = setTimeout(
          () => targetController.abort(),
          REQUEST_TIMEOUT,
        );

        try {
          const targetResponse = await fetch(firstTarget, {
            headers: {
              Accept: '*/*',
            },
            signal: targetController.signal,
          });

          clearTimeout(targetTimeoutId);

          if (!targetResponse.ok) {
            log(`  - Target fetch failed: ${targetResponse.status}`);
            continue;
          }

          const targetData = (await targetResponse.json()) as {
            motivation?: string;
            body?: Array<{ value?: string; purpose?: string }>;
          };
          log(
            `  - Target fetched: motivation=${targetData.motivation || 'unknown'}`,
          );

          if (targetData.motivation !== 'textspotting') {
            log(`  - Not textspotting, skipping`);
            continue;
          }

          const bodyCount = Array.isArray(targetData.body)
            ? targetData.body.length
            : 0;
          log(`  - Target has ${bodyCount} body items`);

          if (bodyCount > 0 && Array.isArray(targetData.body)) {
            const textBodies = targetData.body.filter(
              (b) => b.value && typeof b.value === 'string',
            );
            log(`  - Found ${textBodies.length} text bodies`);

            if (textBodies.length > 0 && textBodies[0]?.value) {
              log(`  - Creating place from text: "${textBodies[0].value}"`);
              placesCreated++;
            }
          }
        } catch (error) {
          clearTimeout(targetTimeoutId);
          log(`  - Target fetch error: ${(error as Error).name}`);
        }

        const elapsed = Date.now() - processingStartTime;
        log(`  - Elapsed: ${elapsed}ms`);

        if (elapsed > 5000) {
          log(`[Debug] Time limit reached`);
          break;
        }
      }

      return NextResponse.json({
        success: true,
        annotationsProcessed: annotations.length,
        placesCreated,
        logs,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      log(
        `[Debug] Error: ${(error as Error).name} - ${(error as Error).message}`,
      );

      return NextResponse.json({
        success: false,
        error: String(error),
        logs,
      });
    }
  } catch (error) {
    log(`[Debug] Outer error: ${String(error)}`);
    return NextResponse.json({
      success: false,
      error: String(error),
      logs,
    });
  }
}
