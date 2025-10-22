import { NextResponse } from 'next/server';
import { fetchAllPlaces, getCacheInfo } from '../../../../lib/gazetteer/data';
import type { GazetteerSearchResult } from '../../../../lib/gazetteer/types';

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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolveUnused, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
    }),
  ]);
}

export async function GET(
  request: Request,
): Promise<NextResponse<ExtendedSearchResult | ErrorResponse>> {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '100'); // Increased default from 50 to 100
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

    // Wrap with timeout to prevent Netlify function timeouts
    const result = await withTimeout(
      fetchAllPlaces({
        search,
        startsWith,
        page,
        limit,
        filter,
      }),
      5000, // 5s timeout - conservative for cold starts
    );

    // Get cache information
    const cacheInfo = getCacheInfo();

    // Search filtering already handled in fetchAllPlaces - no need to duplicate here

    const response = NextResponse.json({
      ...result,
      source: cacheInfo.cached ? 'cache' : 'fresh',
      message: cacheInfo.cached
        ? `From cache (${cacheInfo.cacheAge}s old) - ${result.places.length} places`
        : `Fresh data from AnnoRepo - ${result.places.length} places`,
      cached: cacheInfo.cached,
      cacheAge: cacheInfo.cacheAge,
    });

    // Historical data rarely changes - use longer cache with CDN support
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=7200',
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Gazetteer API error after ${duration}ms:`, error);

    // Handle timeout specifically
    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        {
          error:
            'Request timed out processing data. Try narrowing your search or using filters.',
          places: [],
          totalCount: 0,
          hasMore: false,
          source: 'timeout',
        },
        { status: 504 },
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch places',
        places: [],
        totalCount: 0,
        hasMore: false,
        source: 'error',
      },
      { status: 500 },
    );
  }
}
