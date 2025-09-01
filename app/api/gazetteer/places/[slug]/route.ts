import { fetchPlaceBySlug } from '@/lib/gazetteer/data';
import { NextResponse } from 'next/server';

// Add timeout wrapper
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    
    // Set timeout to 25 seconds (Netlify function timeout is 26s)
    const place = await withTimeout(fetchPlaceBySlug(slug), 25000);

    if (!place) {
      return NextResponse.json({ error: 'Place not found' }, { status: 404 });
    }

    // Add cache headers for better performance
    const response = NextResponse.json(place);
    response.headers.set('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200');

    return response;
  } catch (error) {
    console.error('Error fetching place by slug:', error);
    
    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        { error: 'Request timed out. Please try again later.' },
        { status: 504 },
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch place' },
      { status: 500 },
    );
  }
}
