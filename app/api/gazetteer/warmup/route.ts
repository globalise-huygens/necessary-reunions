import { NextResponse } from 'next/server';
import {
  fetchAllPlaces,
  getCacheStatus,
} from '../../../../lib/gazetteer/data';

/**
 * Warm-up endpoint for gazetteer data
 * Call this endpoint after deployment to pre-populate the cache
 * This prevents 504 timeouts on the first user request
 */
export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Check if cache is already warm
    const cacheStatus = getCacheStatus();

    if (cacheStatus.isValid && cacheStatus.hasData) {
      return NextResponse.json({
        status: 'already-warm',
        cacheAge: cacheStatus.ageMinutes,
        message: `Cache is already warm (${cacheStatus.ageMinutes} minutes old)`,
      });
    }

    console.log('[Warmup] Starting cache warmup...');

    // Fetch initial batch of places to populate cache
    const result = await fetchAllPlaces({
      page: 0,
      limit: 100,
    });

    const duration = Date.now() - startTime;

    console.log(
      `[Warmup] Cache warmed up in ${duration}ms with ${result.places.length} places`,
    );

    return NextResponse.json({
      status: 'warmed',
      duration,
      placesLoaded: result.places.length,
      totalPlaces: result.totalCount,
      truncated: result.truncated,
      warning: result.warning,
      message: 'Cache successfully warmed up',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Warmup] Failed to warm cache after ${duration}ms:`, error);

    return NextResponse.json(
      {
        status: 'failed',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Cache warmup failed - will use fallback data',
      },
      { status: 500 },
    );
  }
}
