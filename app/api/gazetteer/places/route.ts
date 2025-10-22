import { NextResponse } from 'next/server';
import { fetchAllPlaces } from '../../../../lib/gazetteer/data';
import type { GazetteerSearchResult } from '../../../../lib/gazetteer/types';

interface ExtendedSearchResult extends GazetteerSearchResult {
  source: string;
  message: string;
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
      9000, // 9s timeout to stay within Netlify 10s limit
    );

    // Search filtering already handled in fetchAllPlaces - no need to duplicate here

    const response = NextResponse.json({
      ...result,
      source: result.places.length <= 28 ? 'fallback' : 'annorepo',
      message:
        result.places.length <= 28
          ? 'Using fallback test data - external API unavailable'
          : `Successfully loaded ${result.places.length} real places from AnnoRepo`,
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
