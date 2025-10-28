import { NextResponse } from 'next/server';
import { fetchAllPlaces, getCacheInfo } from '../../../../lib/gazetteer/data';
import type { GazetteerSearchResult } from '../../../../lib/gazetteer/types';

// Use Node runtime for 60s Netlify timeout (Edge only has 50s)
export const runtime = 'nodejs';
export const maxDuration = 60;

interface ExtendedSearchResult extends GazetteerSearchResult {
  source: string;
  message: string;
  cacheAge?: number;
  cached?: boolean;
}

interface ErrorResponse {
  error: string;
  places: never[];
  totalCount: number;
  hasMore: boolean;
  source: string;
}

export async function GET(
  request: Request,
): Promise<NextResponse<ExtendedSearchResult | ErrorResponse>> {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '100');
    const startsWith = searchParams.get('startsWith') || undefined;
    const category = searchParams.get('category') || undefined;
    const hasCoordinates = searchParams.get('hasCoordinates') === 'true';
    const hasModernName = searchParams.get('hasModernName') === 'true';
    const source = searchParams.get('source') as
      | 'manual'
      | 'ai-generated'
      | 'all'
      | undefined;

    const filter = {
      category,
      hasCoordinates,
      hasModernName,
      source,
    };

    // Check cache first - if we have data, return it immediately
    const cacheInfo = getCacheInfo();

    if (cacheInfo.cached) {
      // Return cached data immediately without waiting for refresh
      const result = await fetchAllPlaces({
        search,
        startsWith,
        page,
        limit,
        filter,
      });

      const response = NextResponse.json({
        ...result,
        source: 'cache',
        message: `From cache (${cacheInfo.cacheAge}s old) - ${result.places.length} places`,
        cached: true,
        cacheAge: cacheInfo.cacheAge,
      });

      response.headers.set(
        'Cache-Control',
        'public, s-maxage=3600, stale-while-revalidate=7200',
      );

      return response;
    }

    // No cache - fetch from AnnoRepo (Edge Functions have 50s timeout)
    const result = await fetchAllPlaces({
      search,
      startsWith,
      page,
      limit,
      filter,
    });

    const response = NextResponse.json({
      ...result,
      source: 'fresh',
      message: `Fresh data from AnnoRepo - ${result.places.length} places`,
      cached: false,
      cacheAge: 0,
      _debug: {
        processedAnnotations: result.processedAnnotations,
        availableAnnotations: result.availableAnnotations,
        truncated: result.truncated,
      },
    });

    response.headers.set(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=7200',
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Gazetteer API] Error after ${duration}ms:`, error);
    console.error(
      '[Gazetteer API] Error details:',
      error instanceof Error ? error.message : String(error),
    );
    console.error(
      '[Gazetteer API] Error stack:',
      error instanceof Error ? error.stack : 'N/A',
    );

    return NextResponse.json(
      {
        error: 'Failed to fetch places',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack:
          error instanceof Error
            ? error.stack?.split('\n').slice(0, 5).join('\n')
            : undefined,
        places: [],
        totalCount: 0,
        hasMore: false,
        source: 'error',
      },
      { status: 500 },
    );
  }
}
