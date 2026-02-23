/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { NextResponse } from 'next/server';

/**
 * Wikidata entity search with coordinate resolution.
 *
 * Queries the Wikidata API for entities matching a search term,
 * then fetches P625 (coordinate location) claims for each result
 * so we can place them on a map.
 *
 * GET /api/wikidata/search?q=<search>&lang=en&limit=10
 */

interface WikidataSearchEntity {
  id: string;
  label: string;
  description?: string;
  url: string;
}

interface WikidataResult {
  id: string;
  uri: string;
  label: string;
  description?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

interface WikidataSearchResponse {
  results: WikidataResult[];
  error?: string;
}

export async function GET(
  request: Request,
): Promise<NextResponse<WikidataSearchResponse>> {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  const lang = searchParams.get('lang') || 'en';
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 20);

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Step 1: Search for entities
    const searchUrl = new URL('https://www.wikidata.org/w/api.php');
    searchUrl.searchParams.set('action', 'wbsearchentities');
    searchUrl.searchParams.set('search', query);
    searchUrl.searchParams.set('language', lang);
    searchUrl.searchParams.set('uselang', lang);
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('limit', String(limit));
    searchUrl.searchParams.set('type', 'item');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const searchResponse = await fetch(searchUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'NecessaryReunions/1.0 (scholarly annotation tool)',
      },
    });

    clearTimeout(timeoutId);

    if (!searchResponse.ok) {
      return NextResponse.json(
        { error: 'Wikidata search failed', results: [] },
        { status: 502 },
      );
    }

    const searchData = await searchResponse.json();
    const entities: WikidataSearchEntity[] = (searchData.search || []).map(
      (item: any) => ({
        id: item.id,
        label: item.label || item.id,
        description: item.description,
        url: item.concepturi || `https://www.wikidata.org/wiki/${item.id}`,
      }),
    );

    if (entities.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Step 2: Fetch coordinates (P625) for all entities in one SPARQL call
    const entityIds = entities.map((e) => e.id);
    const coordinateMap = await fetchCoordinatesBatch(entityIds);

    // Step 3: Combine results
    const results: WikidataResult[] = entities.map((entity) => ({
      id: entity.id,
      uri: entity.url,
      label: entity.label,
      description: entity.description,
      coordinates: coordinateMap.get(entity.id),
    }));

    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Wikidata request timed out', results: [] },
        { status: 504 },
      );
    }

    console.error('[wikidata/search] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', results: [] },
      { status: 500 },
    );
  }
}

/**
 * Batch-fetch P625 coordinate claims for multiple entities using
 * the wbgetentities API endpoint.
 */
async function fetchCoordinatesBatch(
  entityIds: string[],
): Promise<Map<string, { latitude: number; longitude: number }>> {
  const coordinateMap = new Map<
    string,
    { latitude: number; longitude: number }
  >();

  try {
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.searchParams.set('action', 'wbgetentities');
    url.searchParams.set('ids', entityIds.join('|'));
    url.searchParams.set('props', 'claims');
    url.searchParams.set('format', 'json');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'NecessaryReunions/1.0 (scholarly annotation tool)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return coordinateMap;

    const data = await response.json();
    const entitiesData = data.entities || {};

    for (const [entityId, entityData] of Object.entries(entitiesData)) {
      const claims = (entityData as any).claims;
      if (!claims?.P625?.[0]?.mainsnak?.datavalue?.value) continue;

      const coordValue = claims.P625[0].mainsnak.datavalue.value;
      if (
        typeof coordValue.latitude === 'number' &&
        typeof coordValue.longitude === 'number'
      ) {
        coordinateMap.set(entityId, {
          latitude: coordValue.latitude,
          longitude: coordValue.longitude,
        });
      }
    }
  } catch {
    // Silently fail - coordinates are optional enrichment
  }

  return coordinateMap;
}
