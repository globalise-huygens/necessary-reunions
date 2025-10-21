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

export async function GET(
  request: Request,
): Promise<NextResponse<ExtendedSearchResult | ErrorResponse>> {
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

    const result = await fetchAllPlaces({
      search,
      startsWith,
      page,
      limit,
      filter,
    });

    if (search) {
      const searchLower = search.toLowerCase();
      result.places = result.places.filter(
        (place) =>
          place.name.toLowerCase().includes(searchLower) ||
          place.modernName?.toLowerCase().includes(searchLower) ||
          place.alternativeNames?.some((name) =>
            name.toLowerCase().includes(searchLower),
          ),
      );
      result.totalCount = result.places.length;
    }

    const response = NextResponse.json({
      ...result,
      source: result.places.length <= 28 ? 'fallback' : 'annorepo',
      message:
        result.places.length <= 28
          ? 'Using fallback test data - external API unavailable'
          : `Successfully loaded ${result.places.length} real places from AnnoRepo`,
    });

    // Improved caching with longer revalidation
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600',
    );

    return response;
  } catch (error) {
    console.error('Gazetteer API error:', error);

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
