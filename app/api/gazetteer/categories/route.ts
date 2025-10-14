import { fetchPlaceCategories } from '@/lib/gazetteer/data';
import { NextResponse } from 'next/server';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs),
    ),
  ]);
}

function getFallbackCategories() {
  return [
    { key: 'plaats', label: 'Settlement', count: 3 },
    { key: 'rivier', label: 'River', count: 0 },
    { key: 'eiland', label: 'Island', count: 0 },
    { key: 'berg', label: 'Mountain', count: 0 },
  ];
}

export async function GET() {
  const startTime = Date.now();

  try {
    let categories;

    try {
      categories = await withTimeout(fetchPlaceCategories(), 8000);

      if (!categories || categories.length === 0) {
        categories = getFallbackCategories();
      }
    } catch (error) {
      categories = getFallbackCategories();
    }

    const duration = Date.now() - startTime;

    const response = NextResponse.json(categories);
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=120',
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Error fetching categories after ${duration}ms:`, error);

    return NextResponse.json(getFallbackCategories());
  }
}
