import { resolveAnnoRepoConfig } from '@/lib/shared/annorepo-config';
import { NextResponse } from 'next/server';

export const runtime = 'edge';
const REQUEST_TIMEOUT = 4000;

interface LinkingPageResponse {
  items: unknown[];
  hasMore: boolean;
  page: number;
  count: number;
  error?: string;
}

/**
 * Fetch a single page of linking annotations from AnnoRepo
 * This endpoint is designed to be called multiple times from the client
 */
export async function GET(
  request: Request,
): Promise<NextResponse<LinkingPageResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '0');
    const project = searchParams.get('project') || 'neru';
    const config = resolveAnnoRepoConfig(project);

    const baseQueryUrl = `${config.baseUrl}/services/${config.container}/custom-query/${config.linkingQueryName}:target=,motivationorpurpose=bGlua2luZw==`;
    const customQueryUrl =
      page === 0 ? baseQueryUrl : `${baseQueryUrl}?page=${page}`;

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

    const result = (await response.json()) as {
      items?: unknown[];
      next?: string;
    };

    return NextResponse.json({
      items: result.items || [],
      hasMore: !!result.next,
      page,
      count: result.items?.length || 0,
    });
  } catch (error) {
    console.error(`Failed to fetch linking page:`, error);

    return NextResponse.json({
      items: [],
      hasMore: false,
      page: 0,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
