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

    console.log('[API Server] Fetching from AnnoRepo', {
      targetCanvasId: targetCanvasId.substring(0, 80),
      encoded: encoded.substring(0, 50),
      endpoint: endpoint.substring(0, 120),
      page,
      hasAuthToken: !!process.env.ANNO_REPO_TOKEN_JONA,
    });

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
    }, 5000);

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

    console.log('[API Server] AnnoRepo response received', {
      itemsCount: items.length,
      hasMore,
      page,
      dataKeys: Object.keys(data),
      hasItemsArray: Array.isArray(data.items),
      fullUrl: url.toString(),
      responseStatus: res.status,
    });

    // Debug logging for SVG annotation investigation
    if (items.length > 0) {
      const svgAnnotations = items.filter((item: any) => {
        const selector = item?.target?.selector;
        if (selector?.type === 'SvgSelector') return true;
        if (
          Array.isArray(selector) &&
          selector.some((s: any) => s?.type === 'SvgSelector')
        )
          return true;
        return false;
      });
      console.log('[API Server] SVG annotations analysis', {
        totalItems: items.length,
        svgAnnotations: svgAnnotations.length,
        firstSvgSample: svgAnnotations[0]
          ? {
              id: svgAnnotations[0].id,
              motivation: svgAnnotations[0].motivation,
              selectorType: Array.isArray(svgAnnotations[0].target?.selector)
                ? 'array'
                : svgAnnotations[0].target?.selector?.type,
            }
          : null,
      });
    } else {
      console.warn('[API Server] No items returned from AnnoRepo', {
        canvasId: targetCanvasId.substring(0, 80),
        page,
        responseDataStructure: JSON.stringify(data).substring(0, 200),
      });
    }

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
    console.error('[API Server] Exception in external annotations route', {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
      canvasId: targetCanvasId.substring(0, 80),
    });
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
