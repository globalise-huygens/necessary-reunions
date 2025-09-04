import { fetchGavocPlaces } from '@/lib/gazetteer/data';
import { NextResponse } from 'next/server';

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

    const gavocResult = await fetchGavocPlaces({
      search,
      startsWith,
      page,
      limit,
      filter,
    });

    const response = NextResponse.json({
      ...gavocResult,
      isEnriched: false,
      enrichmentPending: true,
      message: 'Base data loaded, enrichment in progress...',
    });

    response.headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600',
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Gazetteer Stream API error after ${duration}ms:`, error);

    return NextResponse.json(
      {
        error: 'Failed to fetch places',
        places: [],
        totalCount: 0,
        hasMore: false,
        isEnriched: false,
        enrichmentPending: false,
      },
      { status: 500 },
    );
  }
}
