import { encodeCanvasUri } from '@/lib/shared/utils';
import { NextRequest, NextResponse } from 'next/server';
import { promisify } from 'util';
import { gzip } from 'zlib';

const gzipAsync = promisify(gzip);

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const QUERY_NAME = 'with-target';

// Request deduplication cache
const pendingRequests = new Map<string, Promise<any>>();

// Response cache with TTL
interface ApiCacheEntry {
  data: any;
  timestamp: number;
  etag: string;
}

const apiCache = new Map<string, ApiCacheEntry>();
const CACHE_TTL = 15 * 1000; // 15 seconds cache for external API

function generateCacheKey(targetCanvasId: string, page: number): string {
  return `${targetCanvasId}-${page}`;
}

function generateETag(
  targetCanvasId: string,
  page: number,
  timestamp: number,
): string {
  return `"${btoa(
    `${targetCanvasId}-${page}-${Math.floor(timestamp / 10000)}`,
  ).replace(/=/g, '')}"`;
}

async function fetchWithDeduplication(
  url: string,
  headers: HeadersInit,
  cacheKey: string,
): Promise<any> {
  // Check if request is already in flight
  if (pendingRequests.has(cacheKey)) {
    return await pendingRequests.get(cacheKey);
  }

  // Create request promise
  const requestPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
        // Add keepalive for better connection reuse
        // @ts-ignore - keepalive is a valid option but not in types
        keepalive: true,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const txt = await response.text().catch(() => '[no body]');
        throw new Error(
          `API error: ${response.status} ${response.statusText}\n${txt}`,
        );
      }

      return await response.json();
    } finally {
      // Remove from pending requests
      pendingRequests.delete(cacheKey);
    }
  })();

  // Store pending request
  pendingRequests.set(cacheKey, requestPromise);

  return await requestPromise;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetCanvasId = searchParams.get('targetCanvasId');
  const page = parseInt(searchParams.get('page') || '0');
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  const ifNoneMatch = request.headers.get('if-none-match');

  if (!targetCanvasId) {
    return NextResponse.json(
      { error: 'targetCanvasId is required' },
      { status: 400 },
    );
  }

  try {
    const cacheKey = generateCacheKey(targetCanvasId, page);
    const now = Date.now();
    const etag = generateETag(targetCanvasId, page, now);

    // Check client cache
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304 });
    }

    // Check server cache
    const cached = apiCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL) {
      const responseData = {
        ...cached.data,
        cached: true,
        cacheAge: now - cached.timestamp,
      };

      let responseBody: BodyInit = JSON.stringify(responseData);
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ETag: cached.etag,
        'Cache-Control': 'private, max-age=15, must-revalidate',
        'X-Cache': 'HIT',
        'X-Cache-Age': String(now - cached.timestamp),
      };

      // Compress cached response if supported
      if (
        acceptEncoding.includes('gzip') &&
        JSON.stringify(responseData).length > 1024
      ) {
        try {
          const compressed = await gzipAsync(
            Buffer.from(JSON.stringify(responseData)),
          );
          responseBody = new Uint8Array(compressed);
          headers['Content-Encoding'] = 'gzip';
          headers['Content-Length'] = compressed.length.toString();
        } catch (error) {
          // Fall back to uncompressed
        }
      }

      return new Response(responseBody, { status: 200, headers });
    }

    // Fetch fresh data
    const encoded = encodeCanvasUri(targetCanvasId);
    const endpoint = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/${QUERY_NAME}:target=${encoded}`;
    const url = new URL(endpoint);
    url.searchParams.set('page', page.toString());

    const authToken = process.env.ANNO_REPO_TOKEN_JONA;
    if (!authToken) {
      console.warn('ANNO_REPO_TOKEN_JONA not found, attempting without auth');
    }

    const requestHeaders: HeadersInit = {
      Accept: 'application/json',
      'User-Agent': 'necessary-reunions/1.0',
    };

    if (authToken) {
      requestHeaders.Authorization = `Bearer ${authToken}`;
    }

    const data = await fetchWithDeduplication(
      url.toString(),
      requestHeaders,
      cacheKey,
    );

    const items = Array.isArray(data.items) ? data.items : [];
    const hasMore = typeof data.next === 'string';

    const responseData = {
      items,
      hasMore,
      count: items.length,
      cached: false,
      page,
      timestamp: now,
    };

    // Cache the response
    apiCache.set(cacheKey, {
      data: responseData,
      timestamp: now,
      etag,
    });

    // Cleanup old cache entries (keep last 50)
    if (apiCache.size > 50) {
      const entries = Array.from(apiCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      // Remove oldest 10 entries
      for (let i = 0; i < 10 && i < entries.length; i++) {
        apiCache.delete(entries[i][0]);
      }
    }

    let responseBody: BodyInit = JSON.stringify(responseData);
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ETag: etag,
      'Cache-Control': 'private, max-age=15, must-revalidate',
      'X-Cache': 'MISS',
      'X-Item-Count': items.length.toString(),
    };

    // Compress response if supported and beneficial
    if (
      acceptEncoding.includes('gzip') &&
      JSON.stringify(responseData).length > 1024
    ) {
      try {
        const compressed = await gzipAsync(
          Buffer.from(JSON.stringify(responseData)),
        );
        responseBody = new Uint8Array(compressed);
        headers['Content-Encoding'] = 'gzip';
        headers['Content-Length'] = compressed.length.toString();
      } catch (error) {
        console.warn('Gzip compression failed:', error);
      }
    }

    return new Response(responseBody, { status: 200, headers });
  } catch (error) {
    console.error('Error fetching optimized external annotations:', error);

    // Remove from pending requests if failed
    const cacheKey = generateCacheKey(targetCanvasId, page);
    pendingRequests.delete(cacheKey);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      },
      { status: 500 },
    );
  }
}
