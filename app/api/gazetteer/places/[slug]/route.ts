import { NextResponse } from 'next/server';
import type { GazetteerPlace } from '../../../../../lib/gazetteer/types';

interface ErrorResponse {
  error: string;
}

// Cache for individual place lookups (5 minutes)
const placeCache = new Map<
  string,
  { place: GazetteerPlace; timestamp: number }
>();
const CACHE_DURATION = 5 * 60 * 1000;

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse<GazetteerPlace | ErrorResponse>> {
  try {
    const { slug } = await context.params;

    // Check cache first
    const cached = placeCache.get(slug);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      const response = NextResponse.json(cached.place);
      response.headers.set(
        'Cache-Control',
        'public, s-maxage=300, stale-while-revalidate=600',
      );
      return response;
    }

    // Use the bulk API with slug filter
    // Searches first 3 pages in parallel (up to ~300 places) to stay within Netlify timeout
    const apiUrl = new URL(`/api/gazetteer/linking-bulk`, request.url);
    apiUrl.searchParams.set('slug', slug);
    apiUrl.searchParams.set('limit', '1'); // Only need one result

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000); // 9s max - Netlify edge has 10s hard limit

    let response: Response;
    try {
      response = await fetch(apiUrl.toString(), {
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('[PlaceDetail] Request timed out for slug:', slug);
        return NextResponse.json(
          { error: 'Request timed out. Please try again later.' },
          { status: 504 },
        );
      }
      throw fetchError;
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        '[PlaceDetail] API returned error:',
        response.status,
        response.statusText,
      );
      if (response.status === 504) {
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

    const data = (await response.json()) as {
      places: GazetteerPlace[];
      hasMore: boolean;
    };

    const place = data.places[0] || null;

    if (!place) {
      return NextResponse.json({ error: 'Place not found' }, { status: 404 });
    }

    // Cache the result
    placeCache.set(slug, { place, timestamp: Date.now() });

    const jsonResponse = NextResponse.json(place);
    jsonResponse.headers.set(
      'Cache-Control',
      'public, s-maxage=600, stale-while-revalidate=1200',
    );

    return jsonResponse;
  } catch (error) {
    console.error('[PlaceDetail] Error:', error);

    return NextResponse.json(
      { error: 'Failed to fetch place' },
      { status: 500 },
    );
  }
}
