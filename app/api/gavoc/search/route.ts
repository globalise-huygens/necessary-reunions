import { processGavocData } from '@/lib/gavoc/data-processing';
import { searchThesaurus } from '@/lib/gavoc/thesaurus';
import { NextRequest, NextResponse } from 'next/server';

let cachedGavocData: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000;

async function getGavocData() {
  const now = Date.now();

  if (cachedGavocData && now - cacheTimestamp < CACHE_DURATION) {
    return cachedGavocData;
  }

  try {
    const response = await fetch(
      `${
        process.env.NEXTAUTH_URL || 'http://localhost:3000'
      }/gavoc-atlas-index.csv`,
    );
    if (!response.ok) {
      throw new Error('Failed to load GAVOC atlas data');
    }

    const csvText = await response.text();
    const lines = csvText.split('\n').filter((line) => line.trim());

    const headerLine = lines[0];
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
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = (values[index] || '').replace(/"/g, '');
      });
      return row;
    });

    cachedGavocData = processGavocData(rawData);
    cacheTimestamp = now;

    return cachedGavocData;
  } catch (error) {
    console.error('Error loading GAVOC data:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gavocData = await getGavocData();

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

    let results = searchThesaurus(gavocData.thesaurus, query);

    if (category && category !== 'all') {
      results = results.filter((entry) => entry.category === category);
    }

    if (hasCoordinates) {
      results = results.filter((entry) => entry.coordinates);
    }

    if (bbox && bbox.includes(',')) {
      const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
      if (
        !isNaN(minLng) &&
        !isNaN(minLat) &&
        !isNaN(maxLng) &&
        !isNaN(maxLat)
      ) {
        results = results.filter((entry) => {
          if (!entry.coordinates) return false;
          const { latitude: lat, longitude: lng } = entry.coordinates;
          return (
            lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat
          );
        });
      }
    }

    const scoredResults = results.map((entry) => {
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
    });

    if (sortBy === 'relevance') {
      scoredResults.sort((a, b) => b.score - a.score);
    } else if (sortBy === 'name') {
      scoredResults.sort((a, b) =>
        a.entry.preferredTerm.localeCompare(b.entry.preferredTerm),
      );
    } else if (sortBy === 'category') {
      scoredResults.sort((a, b) =>
        a.entry.category.localeCompare(b.entry.category),
      );
    }

    const totalCount = scoredResults.length;
    const paginatedResults = scoredResults.slice(offset, offset + limit);

    const responseData = {
      query,
      results: paginatedResults.map(({ entry, score }) => ({
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
        sampleLocations: entry.locations.slice(0, 2).map((loc) => ({
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

function getMatchType(query: string, entry: any) {
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

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
