import { encodeCanvasUri } from '@/lib/shared/utils';
import { NextRequest, NextResponse } from 'next/server';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const QUERY_NAME = 'with-target';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetCanvasId = searchParams.get('targetCanvasId');
  const page = parseInt(searchParams.get('page') || '0');

  if (!targetCanvasId) {
    return NextResponse.json(
      { error: 'targetCanvasId is required' },
      { status: 400 },
    );
  }

  try {
    const encoded = encodeCanvasUri(targetCanvasId);
    const endpoint = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/${QUERY_NAME}:target=${encoded}`;
    const url = new URL(endpoint);
    url.searchParams.set('page', page.toString());

    const authToken = process.env.ANNO_REPO_TOKEN_JONA;
    if (!authToken) {
      console.warn('ANNO_REPO_TOKEN_JONA not found, attempting without auth');
    }

    const headers: HeadersInit = {
      Accept: 'application/json',
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const res = await fetch(url.toString(), {
      headers,
      // Remove caching in development to see if that helps
      // next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '[no body]');
      console.error(
        `External API error: ${res.status} ${res.statusText}\n${txt}`,
      );
      return NextResponse.json(
        {
          error: `Failed to fetch annotations: ${res.status} ${res.statusText}`,
          details: txt,
        },
        { status: res.status },
      );
    }

    const data = await res.json();
    // Debug logging (can be removed in production)
    if (process.env.NODE_ENV === 'development') {
      console.log(`External API response for page ${page}:`, {
        itemsCount: Array.isArray(data.items) ? data.items.length : 0,
        hasNext: !!data.next,
        hasPrev: !!data.prev,
        totalItems: data.total || 'unknown',
      });
    }

    const items = Array.isArray(data.items) ? data.items : [];
    const hasMore = typeof data.next === 'string';

    // Add cache headers to the response (but remove in dev for debugging)
    const response = NextResponse.json({
      items,
      hasMore,
      page,
      total: data.total,
      next: data.next,
      prev: data.prev,
    });
    // response.headers.set(
    //   'Cache-Control',
    //   'public, s-maxage=60, stale-while-revalidate=300',
    // );

    return response;
  } catch (error) {
    console.error('Error fetching external annotations:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
