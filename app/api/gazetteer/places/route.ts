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

    console.log(
      `Gazetteer API request: search="${search}", page=${page}, limit=${limit}`,
    );

    // Start with GAVOC data only - this is fast and reliable on Netlify
    const result = await fetchGavocPlaces({
      search,
      startsWith,
      page,
      limit,
      filter,
    });

    const duration = Date.now() - startTime;
    console.log(
      `Gazetteer API completed in ${duration}ms, returning ${result.places.length} GAVOC places`,
    );

    // Add cache headers for better performance
    const response = NextResponse.json({
      ...result,
      source: 'gavoc-only',
      message: 'GAVOC atlas data loaded successfully. This is fast and reliable baseline data.',
    });
    
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=600, stale-while-revalidate=1200',
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Gazetteer API error after ${duration}ms:`, error);

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
