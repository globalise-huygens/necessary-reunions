import { NextResponse } from 'next/server';
import { fetchPlaceCategories } from '../../../../lib/gazetteer/data';

interface CategoryItem {
  key: string;
  label: string;
  count: number;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
    }),
  ]);
}

function getFallbackCategories(): CategoryItem[] {
  return [
    { key: 'plaats', label: 'Settlement', count: 3 },
    { key: 'rivier', label: 'River', count: 0 },
    { key: 'eiland', label: 'Island', count: 0 },
    { key: 'berg', label: 'Mountain', count: 0 },
  ];
}

export async function GET(): Promise<NextResponse<CategoryItem[]>> {
  const startTime = Date.now();

  try {
    let categories: CategoryItem[];

    try {
      const fetchedCategories = await withTimeout(fetchPlaceCategories(), 8000);

      if (!Array.isArray(fetchedCategories) || fetchedCategories.length === 0) {
        categories = getFallbackCategories();
      } else {
        categories = fetchedCategories as CategoryItem[];
      }
    } catch {
      categories = getFallbackCategories();
    }

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
