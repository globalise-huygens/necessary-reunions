import { NextRequest, NextResponse } from 'next/server';

// Domains whose tiles may be proxied when direct loading fails
const TILE_PROXY_ALLOWLIST = [
  'iiif.universiteitleiden.nl',
  'digitalcollections.universiteitleiden.nl',
  'service.archief.nl',
  'data.globalise.huygens.knaw.nl',
];

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ArrayBuffer | string>> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing URL parameter', { status: 400 });
  }

  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return new NextResponse('Invalid URL protocol', { status: 400 });
    }

    // Restrict proxying to known IIIF domains
    if (!TILE_PROXY_ALLOWLIST.some((d) => parsedUrl.hostname.endsWith(d))) {
      return new NextResponse('Domain not allowed for proxying', {
        status: 403,
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'IIIF-Viewer/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return new NextResponse(`Failed to fetch image: ${response.statusText}`, {
        status: response.status,
      });
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // IIIF tile images from historical maps rarely change — cache 24 hours
    const isTile = /\/\d+,\d+,\d+,\d+\//.test(parsedUrl.pathname);
    const maxAge = isTile ? 86400 : 3600;

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${maxAge}`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new NextResponse('Upstream server timeout', { status: 504 });
    }
    console.error('Error proxying image:', error);
    return new NextResponse('Failed to proxy image', { status: 500 });
  }
}
