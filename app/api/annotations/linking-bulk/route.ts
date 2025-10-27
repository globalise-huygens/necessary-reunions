import { NextResponse } from 'next/server';

// Use Netlify Edge Functions for longer timeout
export const runtime = 'edge';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const REQUEST_TIMEOUT = 3500; // 3.5 seconds - conservative for Netlify

interface LinkingAnnotation {
  target?: string | string[];
  body?: AnnotationBody | AnnotationBody[];
  motivation?: string;
  [key: string]: unknown;
}

interface AnnotationBody {
  purpose?: string;
  [key: string]: unknown;
}

interface BulkResponse {
  annotations: LinkingAnnotation[];
  iconStates: Record<
    string,
    { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
  >;
  page: number;
  hasMore: boolean;
  count: number;
  error?: string;
}

/**
 * Fetch a single page of linking annotations from AnnoRepo
 * Similar to linking-pages endpoint but processes data for icon states
 */
export async function GET(
  request: Request,
): Promise<NextResponse<BulkResponse>> {
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

    const result = (await response.json()) as {
      items?: LinkingAnnotation[];
      next?: string;
    };

    const annotations = result.items || [];

    // Process icon states from annotations
    const iconStates: Record<
      string,
      { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
    > = {};

    annotations.forEach((annotation) => {
      if (annotation.target && Array.isArray(annotation.target)) {
        annotation.target.forEach((targetUrl: string) => {
          if (!iconStates[targetUrl]) {
            iconStates[targetUrl] = {
              hasGeotag: false,
              hasPoint: false,
              isLinked: false,
            };
          }

          const linkingBody: AnnotationBody[] = Array.isArray(annotation.body)
            ? annotation.body
            : annotation.body
              ? [annotation.body]
              : [];

          if (linkingBody.some((b) => b.purpose === 'geotagging')) {
            iconStates[targetUrl].hasGeotag = true;
          }
          if (linkingBody.some((b) => b.purpose === 'selecting')) {
            iconStates[targetUrl].hasPoint = true;
          }

          iconStates[targetUrl].isLinked = true;
        });
      }
    });

    return NextResponse.json({
      annotations,
      iconStates,
      hasMore: !!result.next,
      page,
      count: annotations.length,
    });
  } catch (error) {
    console.error(`Failed to fetch linking page:`, error);

    // Return empty result instead of error for graceful degradation
    return NextResponse.json({
      annotations: [],
      iconStates: {},
      hasMore: false,
      page: 0,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
