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
      await res.text().catch(() => '[no body]');

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

    return NextResponse.json({ items, hasMore });
  } catch {
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
