import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { processGavocData } from '../../../../lib/gavoc/data-processing';
import type { GavocThesaurusEntry } from '../../../../lib/gavoc/thesaurus';
import { searchThesaurus } from '../../../../lib/gavoc/thesaurus';

interface ProcessedGavocData {
  thesaurus?: {
    entries?: GavocThesaurusEntry[];
    totalConcepts?: number;
  };
}

interface ScoredResult {
  entry: GavocThesaurusEntry;
  score: number;
}

interface SearchResponseData {
  query: string;
  results: Array<{
    id: string;
    preferredTerm: string;
    alternativeTerms: string[];
    category: string;
    coordinates: { latitude: number; longitude: number } | undefined;
    uri: string;
    urlPath: string;
    locationCount: number;
    relevanceScore: number;
    matchType: string;
    sampleLocations: Array<{
      originalNameOnMap: string;
      presentName: string;
      map: string;
    }>;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: {
    category: string | null;
    hasCoordinates: boolean;
    bbox: string | null;
    sortBy: string;
  };
  metadata: {
    apiVersion: string;
    searchPerformedAt: string;
    totalConcepts: number | undefined;
    searchResultCount: number;
  };
}

interface ErrorResponse {
  error: string;
  message?: string;
}

let cachedGavocData: ProcessedGavocData | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000;

function getGavocData(): ProcessedGavocData | null {
  const now = Date.now();

  if (cachedGavocData && now - cacheTimestamp < CACHE_DURATION) {
    return cachedGavocData;
  }

  try {
    const csvPath = path.join(process.cwd(), 'public', 'gavoc-atlas-index.csv');

    if (!fs.existsSync(csvPath)) {
      console.error('GAVOC CSV file not found at:', csvPath);
      return null;
    }

    const csvText = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvText.split('\n').filter((line) => line.trim());

    const headerLine = lines[0];
    if (!headerLine) {
      console.error('No header line found in CSV');
      return null;
    }

    const headers: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < headerLine.length; i++) {
      const char = headerLine[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        headers.push(current.trim().replace(/"/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    headers.push(current.trim().replace(/"/g, ''));

    const rawData = lines.slice(1).map((line) => {
      const values: string[] = [];
      let currentValue = '';
      let inQuotesValue = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotesValue = !inQuotesValue;
        } else if (char === ',' && !inQuotesValue) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());

      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = (values[index] || '').replace(/"/g, '');
      });
      return row;
    });

    cachedGavocData = processGavocData(rawData) as ProcessedGavocData;
    cacheTimestamp = now;

    return cachedGavocData;
  } catch (error) {
    console.error('Error loading GAVOC data:', error);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function GET(
  request: NextRequest,
): Promise<NextResponse<SearchResponseData | ErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const gavocData = getGavocData();

    if (!gavocData?.thesaurus) {
      return NextResponse.json({ error: 'No data available' }, { status: 503 });
    }

    const query = searchParams.get('q') || '';
    const category = searchParams.get('category');
    const hasCoordinates = searchParams.get('coordinates') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sort') || 'relevance';
    const bbox = searchParams.get('bbox');

    if (!query.trim()) {
      return NextResponse.json(
        {
          error: 'Missing search query',
          message: 'Please provide a search query using the "q" parameter',
        },
        { status: 400 },
      );
    }

    const thesaurus = gavocData.thesaurus as unknown as {
      entries: GavocThesaurusEntry[];
      totalConcepts: number;
      totalLocations: number;
      conceptsByCategory: Record<string, number>;
    };
    let results = searchThesaurus(thesaurus, query);

    if (category && category !== 'all') {
      results = results.filter(
        (entry: GavocThesaurusEntry) => entry.category === category,
      );
    }

    if (hasCoordinates) {
      results = results.filter(
        (entry: GavocThesaurusEntry) => entry.coordinates,
      );
    }

    if (bbox && bbox.includes(',')) {
      const bboxValues = bbox.split(',').map(Number);
      const [minLng, minLat, maxLng, maxLat] = bboxValues;
      if (
        minLng !== undefined &&
        minLat !== undefined &&
        maxLng !== undefined &&
        maxLat !== undefined &&
        !isNaN(minLng) &&
        !isNaN(minLat) &&
        !isNaN(maxLng) &&
        !isNaN(maxLat)
      ) {
        results = results.filter((entry: GavocThesaurusEntry) => {
          if (!entry.coordinates) return false;
          const { latitude: lat, longitude: lng } = entry.coordinates;
          return (
            lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat
          );
        });
      }
    }

    const scoredResults: ScoredResult[] = results.map(
      (entry: GavocThesaurusEntry) => {
        const queryLower = query.toLowerCase();
        let score = 0;

        if (entry.preferredTerm.toLowerCase() === queryLower) {
          score += 100;
        } else if (entry.preferredTerm.toLowerCase().startsWith(queryLower)) {
          score += 50;
        } else if (entry.preferredTerm.toLowerCase().includes(queryLower)) {
          score += 25;
        }

        entry.alternativeTerms.forEach((term) => {
          if (term.toLowerCase() === queryLower) {
            score += 75;
          } else if (term.toLowerCase().startsWith(queryLower)) {
            score += 35;
          } else if (term.toLowerCase().includes(queryLower)) {
            score += 15;
          }
        });

        if (entry.coordinates) {
          score += 5;
        }

        score += Math.min(entry.locations.length * 2, 20);

        return { entry, score };
      },
    );

    if (sortBy === 'relevance') {
      scoredResults.sort(
        (a: ScoredResult, b: ScoredResult) => b.score - a.score,
      );
    } else if (sortBy === 'name') {
      scoredResults.sort((a: ScoredResult, b: ScoredResult) =>
        a.entry.preferredTerm.localeCompare(b.entry.preferredTerm),
      );
    } else if (sortBy === 'category') {
      scoredResults.sort((a: ScoredResult, b: ScoredResult) =>
        a.entry.category.localeCompare(b.entry.category),
      );
    }

    const totalCount = scoredResults.length;
    const paginatedResults = scoredResults.slice(offset, offset + limit);

    const responseData: SearchResponseData = {
      query,
      results: paginatedResults.map(({ entry, score }: ScoredResult) => ({
        id: entry.id,
        preferredTerm: entry.preferredTerm,
        alternativeTerms: entry.alternativeTerms,
        category: entry.category,
        coordinates: entry.coordinates,
        uri: entry.uri,
        urlPath: entry.urlPath,
        locationCount: entry.locations.length,
        relevanceScore: score,
        matchType: getMatchType(query, entry),
        sampleLocations: entry.locations
          .slice(0, 2)
          .map((loc: GavocThesaurusEntry['locations'][0]) => ({
            originalNameOnMap: loc.originalNameOnMap,
            presentName: loc.presentName,
            map: loc.map,
          })),
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasNext: offset + limit < totalCount,
        hasPrev: offset > 0,
      },
      filters: {
        category,
        hasCoordinates,
        bbox,
        sortBy,
      },
      metadata: {
        apiVersion: '1.0',
        searchPerformedAt: new Date().toISOString(),
        totalConcepts: gavocData.thesaurus.totalConcepts,
        searchResultCount: totalCount,
      },
    };

    return NextResponse.json(responseData, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    console.error('GAVOC Search API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to perform search',
      },
      { status: 500 },
    );
  }
}

function getMatchType(query: string, entry: GavocThesaurusEntry): string {
  const queryLower = query.toLowerCase();

  if (entry.preferredTerm.toLowerCase() === queryLower) {
    return 'exact-preferred';
  } else if (entry.preferredTerm.toLowerCase().startsWith(queryLower)) {
    return 'prefix-preferred';
  } else if (entry.preferredTerm.toLowerCase().includes(queryLower)) {
    return 'contains-preferred';
  } else if (
    entry.alternativeTerms.some(
      (term: string) => term.toLowerCase() === queryLower,
    )
  ) {
    return 'exact-alternative';
  } else if (
    entry.alternativeTerms.some((term: string) =>
      term.toLowerCase().startsWith(queryLower),
    )
  ) {
    return 'prefix-alternative';
  } else {
    return 'contains-alternative';
  }
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
