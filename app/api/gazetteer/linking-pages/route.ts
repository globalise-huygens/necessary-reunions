import { NextResponse } from 'next/server';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const REQUEST_TIMEOUT = 4000; // 4 seconds - conservative for one page

/**
 * Fetch a single page of linking annotations from AnnoRepo
 * This endpoint is designed to be called multiple times from the client
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '0');

    const customQueryUrl =
      page === 0
        ? `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==`
        : `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==?page=${page}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(customQueryUrl, {
      headers: {
        Accept: '*/*',
        'Cache-Control': 'no-cache',
        'User-Agent': 'curl/8.7.1',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    return NextResponse.json({
      items: result.items || [],
      hasMore: !!result.next,
      page,
      count: (result.items || []).length,
    });
  } catch (error) {
    console.error(`Failed to fetch linking page:`, error);

    // Return empty result instead of error to allow graceful degradation
    return NextResponse.json({
      items: [],
      hasMore: false,
      page: 0,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
