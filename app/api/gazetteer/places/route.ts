import { fetchAllPlaces } from '@/lib/gazetteer/data';
import { NextResponse } from 'next/server';

// Add timeout wrapper
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs),
    ),
  ]);
}

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '50');
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

    console.log(
      `Gazetteer API request: search="${search}", page=${page}, limit=${limit}`,
    );

    // Set aggressive timeout for Netlify (15 seconds)
    const result = await withTimeout(
      fetchAllPlaces({
        search,
        startsWith,
        page,
        limit,
        filter,
      }),
      15000,
    );

    const duration = Date.now() - startTime;
    console.log(
      `Gazetteer API completed in ${duration}ms, returning ${result.places.length} places from AnnoRepo`,
    );

    // Add cache headers for better performance
    const response = NextResponse.json({
      ...result,
      source: 'annorepo',
      message:
        'Data loaded from AnnoRepo with aggressive optimization for Netlify.',
    });

    response.headers.set(
      'Cache-Control',
      'public, s-maxage=600, stale-while-revalidate=1200',
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Gazetteer API error after ${duration}ms:`, error);

    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        {
          error:
            'AnnoRepo request timed out. The server is processing limited data to work within Netlify constraints.',
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
        error: 'Failed to fetch places from AnnoRepo',
        places: [],
        totalCount: 0,
        hasMore: false,
        source: 'error',
      },
      { status: 500 },
    );
  }
}
