import { NextResponse } from 'next/server';
import { fetchPlaceBySlug } from '../../../../../lib/gazetteer/data';
import type { GazetteerPlace } from '../../../../../lib/gazetteer/types';

interface ErrorResponse {
  error: string;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse<GazetteerPlace | ErrorResponse>> {
  try {
    const { slug } = await context.params;

    let place: GazetteerPlace | null = null;

    try {
      place = await fetchPlaceBySlug(slug);
    } catch {
      place = null;
    }

    if (!place) {
      return NextResponse.json({ error: 'Place not found' }, { status: 404 });
    }

    const response = NextResponse.json(place);
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=600, stale-while-revalidate=1200',
    );

    return response;
  } catch (error) {
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
