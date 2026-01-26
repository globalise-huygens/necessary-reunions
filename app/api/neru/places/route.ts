import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

// Force Node.js runtime for fs access
export const runtime = 'nodejs';
// Increase function timeout for file operations
export const maxDuration = 30;

interface NeRuPlace {
  '@context': string;
  id: string;
  type: string;
  _label: string;
  glob_id?: string;
  coord_certainty?: string;
  classified_as?: Array<{
    id: string;
    type: string;
    _label: string;
  }>;
  identified_by: Array<{
    type: string;
    content: string;
    classified_as?: Array<{
      id: string;
      type: string;
      _label: string;
    }>;
  }>;
  referred_to_by?: Array<{
    type: string;
    classified_as: Array<{
      id: string;
      type: string;
      _label: string;
    }>;
    content: string;
  }>;
  part_of?: Array<{
    id: string;
    type: string;
    _label: string;
  }>;
  defined_by?: string;
}

interface SearchResult {
  id: string;
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
  properties: {
    preferredTitle: string;
    title: string;
    alternativeNames: string[];
    type: string;
    types: string[];
    originalDescription?: string;
    context?: string;
  };
  // Keep original NeRu data for linking annotations
  originalData: NeRuPlace;
}

interface NeRuPlacesResponse {
  type: 'FeatureCollection';
  features: SearchResult[];
  totalResults: number;
}

interface ErrorResponseType {
  error: string;
  features?: never[];
}

function parseWKTPoint(wkt: string): [number, number] | null {
  const match = wkt.match(
    /POINT\s*\(\s*([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\s*\)/,
  );
  if (match && match[1] && match[2]) {
    return [parseFloat(match[1]), parseFloat(match[2])];
  }
  return null;
}

function transformNeRuPlace(place: NeRuPlace): SearchResult {
  const names = place.identified_by.filter((item) => item.type === 'Name');

  let preferredTitle = place._label;
  const alternativeNames: string[] = [];

  for (const name of names) {
    const isPref = name.classified_as?.some((cls) => cls.id === 'PREF');
    const isAlt = name.classified_as?.some((cls) => cls.id === 'ALT');

    if (isPref) {
      preferredTitle = name.content;
    } else if (isAlt || name.content !== preferredTitle) {
      alternativeNames.push(name.content);
    }
  }

  const types = place.classified_as?.map((cls) => cls._label) || [];

  const descriptions = place.referred_to_by
    ?.filter((ref) =>
      ref.classified_as.some(
        (cls) =>
          cls._label === 'Description' ||
          cls._label === 'Remarks' ||
          cls._label === 'HistoricalDescription',
      ),
    )
    .map((ref) => ref.content);

  let coordinates: [number, number] | null = null;
  if (place.defined_by) {
    coordinates = parseWKTPoint(place.defined_by);
  }

  const context = place.part_of?.map((p) => p._label).join(', ');

  return {
    id: place.id,
    type: 'Feature',
    geometry: coordinates ? { type: 'Point', coordinates } : null,
    properties: {
      preferredTitle,
      title: place._label,
      alternativeNames,
      type: types[0] || 'Place',
      types,
      originalDescription: descriptions?.join('\n'),
      context,
    },
    originalData: place,
  };
}

// Cache the dataset in memory
let cachedData: NeRuPlace[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function loadNeRuData(request: NextRequest): Promise<NeRuPlace[]> {
  const now = Date.now();

  // Return cached data if valid
  if (cachedData && now - cacheTimestamp < CACHE_TTL) {
    return cachedData;
  }

  // Try filesystem first (works in local dev and some deployment configs)
  const possiblePaths = [
    path.join(process.cwd(), 'public', 'neru-place-dataset.json'),
    path.join(process.cwd(), '.next', 'static', 'neru-place-dataset.json'),
    '/var/task/public/neru-place-dataset.json', // Netlify serverless path
    path.resolve('public', 'neru-place-dataset.json'),
  ];

  for (const filePath of possiblePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        cachedData = JSON.parse(fileContent) as NeRuPlace[];
        cacheTimestamp = now;
        console.log(`Loaded NeRu dataset from filesystem: ${filePath}`);
        return cachedData;
      }
    } catch {
      continue;
    }
  }

  // Fallback: fetch via HTTP (works on Netlify where public files are static)
  try {
    const origin = request.nextUrl.origin;
    const response = await fetch(`${origin}/neru-place-dataset.json`);
    if (response.ok) {
      cachedData = (await response.json()) as NeRuPlace[];
      cacheTimestamp = now;
      console.log('Loaded NeRu dataset via HTTP fetch');
      return cachedData;
    }
  } catch (error) {
    console.error('HTTP fetch fallback failed:', error);
  }

  console.error(
    'NeRu place dataset not found in any location. Tried filesystem paths:',
    possiblePaths,
  );
  throw new Error('NeRu place dataset not found');
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<NeRuPlacesResponse | ErrorResponseType>> {
  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get('name');
  const globId = searchParams.get('glob_id');
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  // Allow either name or glob_id search
  if (
    (!name || name.trim().length === 0) &&
    (!globId || globId.trim().length === 0)
  ) {
    return NextResponse.json(
      { error: 'Either name or glob_id parameter is required' },
      { status: 400 },
    );
  }

  try {
    const data = await loadNeRuData(request);

    let matchingPlaces: SearchResult[];

    if (globId) {
      // Search by glob_id (exact match)
      const place = data.find((p) => p.glob_id === globId);
      matchingPlaces = place ? [transformNeRuPlace(place)] : [];
    } else {
      // Search by name
      const queryLower = name!.toLowerCase();

      matchingPlaces = data
        .filter((place) => {
          // Match on _label
          const labelMatch = place._label.toLowerCase().includes(queryLower);

          // Match on alternative names
          const altNamesMatch = place.identified_by
            .filter((id) => id.type === 'Name')
            .some((n) => n.content.toLowerCase().includes(queryLower));

          return labelMatch || altNamesMatch;
        })
        .slice(0, limit)
        .map(transformNeRuPlace);
    }

    return NextResponse.json({
      type: 'FeatureCollection',
      features: matchingPlaces,
      totalResults: matchingPlaces.length,
    });
  } catch (error) {
    console.error('NeRu places search error:', error);
    return NextResponse.json(
      { error: 'Failed to search NeRu places', features: [] },
      { status: 500 },
    );
  }
}
