import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { processGavocData } from '../../../../../lib/gavoc/data-processing';
import type { GavocLocation } from '../../../../../lib/gavoc/types';
import type { GazetteerPlace } from '../../../../../lib/gazetteer/types';

interface ErrorResponse {
  error: string;
}

const placeCache = new Map<
  string,
  { place: GazetteerPlace; timestamp: number }
>();
const CACHE_DURATION = 10 * 1000;

let gavocFallbackCache: { places: GazetteerPlace[]; timestamp: number } | null =
  null;

function parseCsvRows(csvText: string): Array<Record<string, string>> {
  const lines = csvText.split('\n').filter((line) => line.trim());
  const headerLine = lines[0];
  if (!headerLine) return [];

  const parseLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/"/g, ''));
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim().replace(/"/g, ''));
    return values;
  };

  const headers = parseLine(headerLine);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
}

function createSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function gavocLocationToPlace(location: GavocLocation): GazetteerPlace {
  const name =
    location.presentName && location.presentName !== '-'
      ? location.presentName
      : location.originalNameOnMap;

  return {
    id:
      location.uri ||
      `https://necessaryreunions.org/gavoc/${location.indexPage}`,
    name,
    category: location.category || 'place',
    coordinates:
      typeof location.longitude === 'number' &&
      typeof location.latitude === 'number'
        ? { x: location.longitude, y: location.latitude }
        : undefined,
    coordinateType:
      typeof location.longitude === 'number' &&
      typeof location.latitude === 'number'
        ? 'geographic'
        : undefined,
    alternativeNames: location.alternativeNames,
    modernName:
      location.presentName &&
      location.presentName !== location.originalNameOnMap
        ? location.presentName
        : undefined,
    linkingAnnotationId: location.id,
    textParts: [],
    isGeotagged: location.hasCoordinates,
    hasPointSelection: false,
    hasGeotagging: location.hasCoordinates,
    hasHumanVerification: false,
    geotagSource: {
      id:
        location.uri ||
        `https://necessaryreunions.org/gavoc/${location.indexPage}`,
      label: name,
      thesaurus: 'gavoc',
    },
    mapReferences: [
      {
        mapId: location.map,
        mapTitle: location.map,
        canvasId: '',
        gridSquare: location.mapGridSquare,
        pageNumber: location.page,
        linkingAnnotationId: location.id,
      },
    ],
    linkingAnnotationCount: 1,
  };
}

function getGavocFallbackPlaces(): GazetteerPlace[] {
  if (
    gavocFallbackCache &&
    Date.now() - gavocFallbackCache.timestamp < 5 * 60 * 1000
  ) {
    return gavocFallbackCache.places;
  }

  try {
    const csvPath = path.join(process.cwd(), 'public', 'gavoc-atlas-index.csv');
    const csvText = fs.readFileSync(csvPath, 'utf-8');
    const processed = processGavocData(parseCsvRows(csvText));
    const places = processed.locations.map(gavocLocationToPlace);
    gavocFallbackCache = { places, timestamp: Date.now() };
    return places;
  } catch {
    return [];
  }
}

function findGavocFallbackPlace(slug: string): GazetteerPlace | null {
  return (
    getGavocFallbackPlaces().find((place) => {
      const candidates = [
        place.name,
        place.modernName || '',
        ...(place.alternativeNames || []),
      ];
      return candidates.some((candidate) => createSlug(candidate) === slug);
    }) || null
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse<GazetteerPlace | ErrorResponse>> {
  try {
    const { slug } = await context.params;

    const url = new URL(request.url);
    const bypassCache = url.searchParams.get('nocache') === 'true';

    const cached = placeCache.get(slug);
    if (
      !bypassCache &&
      cached &&
      Date.now() - cached.timestamp < CACHE_DURATION
    ) {
      const response = NextResponse.json(cached.place);
      response.headers.set(
        'Cache-Control',
        'public, s-maxage=10, stale-while-revalidate=30',
      );
      return response;
    }

    const apiUrl = new URL(`/api/gazetteer/linking-bulk`, request.url);
    apiUrl.searchParams.set('slug', slug);
    apiUrl.searchParams.set('limit', '1');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    let response: Response;
    try {
      response = await fetch(apiUrl.toString(), {
        signal: controller.signal,
        cache: 'no-store',
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timed out. Please try again later.' },
          { status: 504 },
        );
      }
      throw fetchError;
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 504) {
        return NextResponse.json(
          { error: 'Request timed out. Please try again later.' },
          { status: 504 },
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch place' },
        { status: 500 },
      );
    }

    const data = (await response.json()) as {
      places: GazetteerPlace[];
      hasMore: boolean;
    };

    const place = data.places[0] || null;

    if (!place) {
      const fallbackPlace = findGavocFallbackPlace(slug);
      if (fallbackPlace) {
        placeCache.set(slug, { place: fallbackPlace, timestamp: Date.now() });
        const fallbackResponse = NextResponse.json(fallbackPlace);
        fallbackResponse.headers.set(
          'Cache-Control',
          'public, s-maxage=60, stale-while-revalidate=300',
        );
        return fallbackResponse;
      }

      return NextResponse.json({ error: 'Place not found' }, { status: 404 });
    }

    placeCache.set(slug, { place, timestamp: Date.now() });

    const jsonResponse = NextResponse.json(place);
    jsonResponse.headers.set(
      'Cache-Control',
      'public, s-maxage=10, stale-while-revalidate=30',
    );

    return jsonResponse;
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch place' },
      { status: 500 },
    );
  }
}
