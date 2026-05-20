import fs from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

const MANIFEST_PROXY_ALLOWLIST = [
  'data.globalise.huygens.knaw.nl',
  'globalise-huygens.github.io',
  'iiif.universiteitleiden.nl',
  'digitalcollections.universiteitleiden.nl',
  'images.uba.uva.nl',
];

let localManifestCache: any | null = null;

async function getLocalManifestCollection(): Promise<any | null> {
  if (localManifestCache) return localManifestCache;

  try {
    const manifestPath = path.join(process.cwd(), 'data', 'manifest.json');
    const manifestText = await fs.readFile(manifestPath, 'utf-8');
    localManifestCache = JSON.parse(manifestText);
    return localManifestCache;
  } catch {
    return null;
  }
}

async function getLocalManifestFallback(
  manifestUrl: string,
): Promise<string | null> {
  const collection = await getLocalManifestCollection();
  const items = Array.isArray(collection?.items) ? collection.items : [];
  const canvasPrefix = `${manifestUrl.replace(/\/$/, '')}/canvas/`;
  const canvas = items.find(
    (item: any) =>
      typeof item?.id === 'string' && item.id.startsWith(canvasPrefix),
  );

  if (!canvas) return null;

  return JSON.stringify({
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: manifestUrl,
    type: 'Manifest',
    label: canvas.label,
    metadata: canvas.metadata || [],
    items: [canvas],
  });
}

function createManifestResponse(
  manifestText: string,
  contentType = 'application/json',
): NextResponse<string> {
  return new NextResponse(manifestText, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<Record<string, string>> | NextResponse<string>> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { error: 'Missing URL parameter' },
      { status: 400 },
    );
  }

  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: 'Invalid URL protocol' },
        { status: 400 },
      );
    }

    if (!MANIFEST_PROXY_ALLOWLIST.some((d) => parsedUrl.hostname.endsWith(d))) {
      return NextResponse.json(
        { error: 'Domain not allowed for proxying' },
        { status: 403 },
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(parsedUrl.toString(), {
        headers: {
          Accept: 'application/json, application/ld+json;q=0.9, */*;q=0.1',
          'User-Agent': 'Necessary-Reunions/1.0',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const fallbackManifest = await getLocalManifestFallback(
          parsedUrl.toString(),
        );
        if (fallbackManifest) {
          return createManifestResponse(fallbackManifest);
        }

        return NextResponse.json(
          {
            error: `Failed to fetch manifest: ${response.statusText}`,
            status: response.status,
          },
          { status: 200 },
        );
      }

      const manifestText = await response.text();
      return createManifestResponse(
        manifestText,
        response.headers.get('content-type') || 'application/json',
      );
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const fallbackManifest = await getLocalManifestFallback(url).catch(
        () => null,
      );
      if (fallbackManifest) {
        return createManifestResponse(fallbackManifest);
      }

      return NextResponse.json(
        { error: 'Upstream manifest server timeout' },
        { status: 200 },
      );
    }

    console.error('Error proxying manifest:', error);
    return NextResponse.json(
      { error: 'Failed to proxy manifest' },
      { status: 500 },
    );
  }
}
