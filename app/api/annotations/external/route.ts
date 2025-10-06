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

    // Add timeout to prevent infinite hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 5000); // 5 second timeout

    const res = await fetch(url.toString(), {
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const txt = await res.text().catch(() => '[no body]');
      console.error(`External API error: ${res.status} ${res.statusText}`);

      // Return empty result instead of error to prevent infinite loops
      return NextResponse.json(
        {
          items: [],
          hasMore: false,
          message: `External service unavailable: ${res.status}`,
        },
        { status: 200 },
      );
    }

    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    const hasMore = typeof data.next === 'string';

    console.log(
      `[EXTERNAL API] Successfully loaded ${items.length} annotations`,
    );
    return NextResponse.json({ items, hasMore });
  } catch (error) {
    console.error('Error fetching external annotations:', error);

    // Return empty result instead of error to prevent infinite loops
    return NextResponse.json(
      {
        items: [],
        hasMore: false,
        message: 'External annotation service timeout',
      },
      { status: 200 },
    );
  }
}
