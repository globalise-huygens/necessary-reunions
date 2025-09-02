import { fetchPlaceCategories } from '@/lib/gazetteer/data';
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

export async function GET() {
  const startTime = Date.now();
  
  try {
    console.log('Fetching gazetteer categories');

    // Set timeout to 20 seconds (well below Netlify's 26s limit)
    const categories = await withTimeout(fetchPlaceCategories(), 20000);

    const duration = Date.now() - startTime;
    console.log(`Gazetteer categories fetched in ${duration}ms, returning ${categories.length} categories`);

    // Add cache headers for better performance
    const response = NextResponse.json(categories);
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=600, stale-while-revalidate=1200',
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Error fetching categories after ${duration}ms:`, error);

    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        { error: 'Request timed out. Please try again later.' },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 },
    );
  }
}
