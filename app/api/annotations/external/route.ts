import { NextRequest, NextResponse } from 'next/server';
import { resolveAnnoRepoConfig } from '@/lib/shared/annorepo-config';
import { encodeCanvasUri } from '../../../../lib/shared/utils';

export async function GET(
  request: NextRequest,
): Promise<
  NextResponse<
    { error: string } | { items: unknown[]; hasMore: boolean; message?: string }
  >
> {
  const { searchParams } = new URL(request.url);
  const targetCanvasId = searchParams.get('targetCanvasId');
  const page = parseInt(searchParams.get('page') || '0');
  const project = searchParams.get('project');

  if (!targetCanvasId) {
    return NextResponse.json(
      { error: 'targetCanvasId is required' },
      { status: 400 },
    );
  }

  try {
    const { baseUrl, container, authToken, customQueryName } =
      resolveAnnoRepoConfig(project);
    const encoded = encodeCanvasUri(targetCanvasId);
    const endpoint = `${baseUrl}/services/${container}/custom-query/${customQueryName}:target=${encoded}`;
    const url = new URL(endpoint);
    url.searchParams.set('page', page.toString());

    if (!authToken) {
      console.warn(
        '[API Server] No auth token found for project:',
        project || 'neru',
      );
    }

    const headers: HeadersInit = {
      Accept: 'application/json',
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 8000); // 8s to stay within Netlify's 10s serverless function limit

    const res = await fetch(url.toString(), {
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '[no body]');
      console.error('[API Server] AnnoRepo error', {
        status: res.status,
        statusText: res.statusText,
        errorBody: errorBody.slice(0, 200),
      });

      return NextResponse.json(
        {
          items: [],
          hasMore: false,
          message: `External service unavailable: ${res.status}`,
        },
        { status: 200 },
      );
    }

    const data = (await res.json()) as {
      items?: unknown[];
      next?: string;
    };
    const items = Array.isArray(data.items) ? data.items : [];
    const hasMore = typeof data.next === 'string';

    const cacheHeaders = {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
    };

    // Add debug info to response when no items
    if (items.length === 0) {
      return NextResponse.json(
        {
          items,
          hasMore,
          debug: {
            canvasId: targetCanvasId,
            encoded: encoded.slice(0, 100),
            endpoint: url.toString(),
            hasAuthToken: !!authToken,
            responseKeys: Object.keys(data),
            responseStatus: res.status,
          },
        },
        { headers: cacheHeaders },
      );
    }

    return NextResponse.json({ items, hasMore }, { headers: cacheHeaders });
  } catch (error) {
    const errorDetails = {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorCause:
        error instanceof Error && 'cause' in error
          ? String(error.cause)
          : 'none',
      canvasId: targetCanvasId.slice(0, 80),
      isAbortError: error instanceof Error && error.name === 'AbortError',
      stack: error instanceof Error ? error.stack?.slice(0, 500) : undefined,
    };

    console.error(
      '[API Server] Exception in external annotations route',
      errorDetails,
    );

    // Return detailed error info for debugging
    return NextResponse.json(
      {
        items: [],
        hasMore: false,
        message:
          error instanceof Error && error.name === 'AbortError'
            ? 'External annotation service timeout (8s)'
            : 'External annotation service error',
        debug: errorDetails,
      },
      { status: 200 },
    );
  }
}
