import { NextRequest, NextResponse } from 'next/server';
import { encodeCanvasUri } from '../../../../lib/shared/utils';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const QUERY_NAME = 'with-target';

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
      console.warn('[API Server] No ANNO_REPO_TOKEN_JONA found in environment');
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
    }, 15000); // Increased from 5s to 15s for Netlify cold starts

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
        errorBody: errorBody.substring(0, 200),
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

    // Add debug info to response when no items
    if (items.length === 0) {
      return NextResponse.json({
        items,
        hasMore,
        debug: {
          canvasId: targetCanvasId,
          encoded: encoded.substring(0, 100),
          endpoint: url.toString(),
          hasAuthToken: !!authToken,
          responseKeys: Object.keys(data),
          responseStatus: res.status,
        },
      });
    }

    return NextResponse.json({ items, hasMore });
  } catch (error) {
    const errorDetails = {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorCause:
        error instanceof Error && 'cause' in error
          ? String(error.cause)
          : 'none',
      canvasId: targetCanvasId.substring(0, 80),
      isAbortError: error instanceof Error && error.name === 'AbortError',
      stack:
        error instanceof Error ? error.stack?.substring(0, 500) : undefined,
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
            ? 'External annotation service timeout (15s)'
            : 'External annotation service error',
        debug: errorDetails,
      },
      { status: 200 },
    );
  }
}
