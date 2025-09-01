import { fetchAllPlaces, fetchPlaceCategories } from '@/lib/gazetteer/data';
import { NextResponse } from 'next/server';

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

    const result = await fetchAllPlaces({
      search,
      startsWith,
      page,
      limit,
      filter,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in gazetteer API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch places' },
      { status: 500 },
    );
  }
}
