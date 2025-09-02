import { fetchGavocPlaceCategories } from '@/lib/gazetteer/data';
import { NextResponse } from 'next/server';

export async function GET() {
  const startTime = Date.now();

  try {
    console.log('Fetching GAVOC gazetteer categories');

    // Use the fast GAVOC-only categories function
    const categories = await fetchGavocPlaceCategories();

    const duration = Date.now() - startTime;
    console.log(
      `GAVOC gazetteer categories fetched in ${duration}ms, returning ${categories.length} categories`,
    );

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

    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 },
    );
  }
}
