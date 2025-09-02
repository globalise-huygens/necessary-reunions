import { fetchPlaceBySlug } from '@/lib/gazetteer/data';
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

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const startTime = Date.now();

  try {
    const { slug } = await context.params;
    console.log(`Fetching place by slug: ${slug}`);

    // Set timeout to 20 seconds (well below Netlify's 26s limit)
    const place = await withTimeout(fetchPlaceBySlug(slug), 20000);

    const duration = Date.now() - startTime;

    if (!place) {
      console.log(`Place not found for slug: ${slug} (${duration}ms)`);
      return NextResponse.json({ error: 'Place not found' }, { status: 404 });
    }

    console.log(
      `Found place "${place.name}" for slug: ${slug} (${duration}ms)`,
    );

    // Add cache headers for better performance
    const response = NextResponse.json(place);
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=600, stale-while-revalidate=1200',
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Error fetching place by slug after ${duration}ms:`, error);

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
