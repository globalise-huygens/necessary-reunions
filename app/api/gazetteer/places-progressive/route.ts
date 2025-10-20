import { NextResponse } from 'next/server';
import { fetchAllPlacesProgressive } from '../../../../lib/gazetteer/data';
import type { GazetteerSearchResult } from '../../../../lib/gazetteer/types';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolveUnused, reject) => {
      setTimeout(() => {
        reject(new Error('Request timeout'));
      }, timeoutMs);
    }),
  ]);
}

interface ProgressiveSearchResult extends GazetteerSearchResult {
  source: string;
  message: string;
}

interface ErrorResponse {
  error: string;
  places: never[];
  totalCount: number;
  hasMore: boolean;
  source: string;
}

export async function GET(
  request: Request,
): Promise<NextResponse<ProgressiveSearchResult | ErrorResponse>> {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '50');
    const startsWith = searchParams.get('startsWith') || undefined;
    const category = searchParams.get('category') || undefined;
    const hasCoordinates = searchParams.get('hasCoordinates') === 'true';
    const hasModernName = searchParams.get('hasModernName') === 'true';
    const source = searchParams.get('source') as
      | 'manual'
      | 'ai-generated'
      | 'all'
      | undefined;

    const filter = {
      category,
      hasCoordinates,
      hasModernName,
      source,
    };

    const result = await withTimeout(
      fetchAllPlacesProgressive({
        search,
        startsWith,
        page,
        limit,
        filter,
      }),
      20000,
    );

    const response = NextResponse.json({
      ...result,
      source: 'annorepo-progressive',
      message:
        'Extended data loaded from AnnoRepo with higher limits for progressive loading.',
    });

    response.headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600',
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `Progressive Gazetteer API error after ${duration}ms:`,
      error,
    );

    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        {
          error:
            'Progressive loading timed out. The dataset may be too large for current serverless constraints.',
          places: [],
          totalCount: 0,
          hasMore: false,
          source: 'timeout',
        },
        { status: 504 },
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch extended places from AnnoRepo',
        places: [],
        totalCount: 0,
        hasMore: false,
        source: 'error',
      },
      { status: 500 },
    );
  }
}
