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

    // Use the progressive loading API to find the place
    // This is much more efficient than loading all places
    let place: GazetteerPlace | null = null;
    let page = 0;
    const maxPages = 10; // Search first 1000 places (10 pages * 100)

    while (!place && page < maxPages) {
      try {
        const apiUrl = new URL(
          `/api/gazetteer/linking-bulk?page=${page}`,
          request.url,
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(apiUrl.toString(), {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          break;
        }

        const data = (await response.json()) as {
          places: GazetteerPlace[];
          hasMore: boolean;
        };

        // Search for the place in this page
        place =
          data.places.find((p) => {
            const placeSlug = p.name
              .toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/g, '');
            return placeSlug === slug;
          }) || null;

        if (!place && !data.hasMore) {
          break; // No more pages to search
        }

        page++;
      } catch (error) {
        console.error(
          `[PlaceDetail] Error fetching page ${page}:`,
          error instanceof Error ? error.message : 'Unknown error',
        );
        break;
      }
    }

    if (!place) {
      return NextResponse.json({ error: 'Place not found' }, { status: 404 });
    }

    // Cache the result
    placeCache.set(slug, { place, timestamp: Date.now() });

    const response = NextResponse.json(place);
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=600, stale-while-revalidate=1200',
    );

    return response;
  } catch (error) {
    console.error('[PlaceDetail] Error:', error);

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
