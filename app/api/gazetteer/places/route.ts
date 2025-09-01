import { fetchAllPlaces, fetchPlaceCategories } from '@/lib/gazetteer/data';
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

    // Set timeout to 25 seconds (Netlify function timeout is 26s)
    const result = await withTimeout(
      fetchAllPlaces({
        search,
        startsWith,
        page,
        limit,
        filter,
      }),
      25000,
    );

    // Add cache headers for better performance
    const response = NextResponse.json(result);
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600',
    );

    return response;
  } catch (error) {
    console.error('Error in gazetteer API:', error);

    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        { error: 'Request timed out. Please try again later.' },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch places' },
      { status: 500 },
    );
  }
}
