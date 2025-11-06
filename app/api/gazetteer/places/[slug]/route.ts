import { NextResponse } from 'next/server';
import type { GazetteerPlace } from '../../../../../lib/gazetteer/types';

interface ErrorResponse {
  error: string;
}

const placeCache = new Map<
  string,
  { place: GazetteerPlace; timestamp: number }
>();
const CACHE_DURATION = 10 * 1000; // 10 seconds - short cache to allow quick updates

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse<GazetteerPlace | ErrorResponse>> {
  try {
    const { slug } = await context.params;

    const url = new URL(request.url);
    const bypassCache = url.searchParams.get('nocache') === 'true';

    const cached = placeCache.get(slug);
    if (
      !bypassCache &&
      cached &&
      Date.now() - cached.timestamp < CACHE_DURATION
    ) {
      const response = NextResponse.json(cached.place);
      response.headers.set(
        'Cache-Control',
        'public, s-maxage=10, stale-while-revalidate=30',
      );
      return response;
    }

    const apiUrl = new URL(`/api/gazetteer/linking-bulk`, request.url);
    apiUrl.searchParams.set('slug', slug);
    apiUrl.searchParams.set('limit', '1');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 seconds for places with many annotations

    let response: Response;
    try {
      response = await fetch(apiUrl.toString(), {
        signal: controller.signal,
        cache: 'no-store',
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timed out. Please try again later.' },
          { status: 504 },
        );
      }
      throw fetchError;
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
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

    placeCache.set(slug, { place, timestamp: Date.now() });

    const jsonResponse = NextResponse.json(place);
    jsonResponse.headers.set(
      'Cache-Control',
      'public, s-maxage=10, stale-while-revalidate=30',
    );

    return jsonResponse;
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch place' },
      { status: 500 },
    );
  }
}
