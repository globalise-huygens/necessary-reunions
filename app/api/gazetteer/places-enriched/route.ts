import { fetchAllPlaces } from '@/lib/gazetteer/data';
import { NextResponse } from 'next/server';

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

    const result = await withTimeout(
      fetchAllPlaces({
        search,
        startsWith,
        page,
        limit,
        filter,
      }),
      20000,
    );

    const duration = Date.now() - startTime;

    const response = NextResponse.json({
      ...result,
      source: 'enriched',
      message: 'Enriched data with annotations from AnnoRepo.',
    });

    response.headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600',
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Enriched Gazetteer API error after ${duration}ms:`, error);

    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        {
          error:
            'Request timed out. The enriched data is taking too long to process. Try the basic endpoint instead.',
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
        error: 'Failed to fetch enriched places',
        places: [],
        totalCount: 0,
        hasMore: false,
        source: 'error',
      },
      { status: 500 },
    );
  }
}
