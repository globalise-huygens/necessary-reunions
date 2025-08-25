import { fetchPlaceBySlug } from '@/lib/gazetteer/data';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const place = await fetchPlaceBySlug(slug);

    if (!place) {
      return NextResponse.json({ error: 'Place not found' }, { status: 404 });
    }

    return NextResponse.json(place);
  } catch (error) {
    console.error('Error fetching place by slug:', error);
    return NextResponse.json(
      { error: 'Failed to fetch place' },
      { status: 500 },
    );
  }
}
