import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { processGavocData } from '../../../../lib/gavoc/data-processing';
import type { GavocThesaurusEntry } from '../../../../lib/gavoc/thesaurus';

interface ConceptResponseData {
  concepts: Array<{
    id: string;
    preferredTerm: string;
    alternativeTerms: string[];
    category: string;
    coordinates: { latitude: number; longitude: number } | undefined;
    uri: string;
    urlPath: string;
    locationCount: number;
    sampleLocations: Array<{
      id: string;
      originalNameOnMap: string;
      presentName: string;
      map: string;
      page: string;
    }>;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  metadata: {
    apiVersion: string;
    generatedAt: string;
    totalConcepts: number;
    filteredConcepts: number;
  };
}

interface ErrorResponse {
  error: string;
  message: string;
}

let cachedData: {
  entries: GavocThesaurusEntry[];
  lastUpdated: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000;

function getGavocData(): GavocThesaurusEntry[] {
  const now = Date.now();

  if (cachedData && now - cachedData.lastUpdated < CACHE_DURATION) {
    return cachedData.entries;
  }

  try {
    const csvPath = path.join(process.cwd(), 'public', 'gavoc-atlas-index.csv');

    if (!fs.existsSync(csvPath)) {
      console.error('GAVOC CSV file not found at:', csvPath);
      return [];
    }

    const csvText = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvText.split('\n').filter((line) => line.trim());

    const headerLine = lines[0];
    if (!headerLine) {
      console.error('No header line found in CSV');
      return [];
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

    const processedData = processGavocData(rawData);
    const thesaurus = processedData.thesaurus as
      | { entries?: GavocThesaurusEntry[] }
      | undefined;

    cachedData = {
      entries: thesaurus?.entries || [],
      lastUpdated: now,
    };

    return cachedData.entries;
  } catch (error) {
    console.error('Error loading GAVOC data:', error);
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function GET(
  request: NextRequest,
): Promise<NextResponse<ConceptResponseData | ErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const entries = getGavocData();

    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const hasCoordinates = searchParams.get('coordinates') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const format = searchParams.get('format') || 'json';

    let filteredEntries = entries;

    if (category && category !== 'all') {
      filteredEntries = filteredEntries.filter(
        (entry) => entry.category === category,
      );
    }

    if (search) {
      const searchTerm = search.toLowerCase();
      filteredEntries = filteredEntries.filter(
        (entry) =>
          entry.preferredTerm.toLowerCase().includes(searchTerm) ||
          entry.alternativeTerms.some((term) =>
            term.toLowerCase().includes(searchTerm),
          ),
      );
    }

    if (hasCoordinates) {
      filteredEntries = filteredEntries.filter((entry) => entry.coordinates);
    }

    const totalCount = filteredEntries.length;

    const paginatedEntries = filteredEntries.slice(offset, offset + limit);

    const responseData = {
      concepts: paginatedEntries.map((entry) => ({
        id: entry.id,
        preferredTerm: entry.preferredTerm,
        alternativeTerms: entry.alternativeTerms,
        category: entry.category,
        coordinates: entry.coordinates,
        uri: entry.uri,
        urlPath: entry.urlPath,
        locationCount: entry.locations.length,
        sampleLocations: entry.locations.slice(0, 3).map((loc) => ({
          id: loc.id,
          originalNameOnMap: loc.originalNameOnMap,
          presentName: loc.presentName,
          map: loc.map,
          page: loc.page,
        })),
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasNext: offset + limit < totalCount,
        hasPrev: offset > 0,
      },
      metadata: {
        apiVersion: '1.0',
        generatedAt: new Date().toISOString(),
        totalConcepts: entries.length,
        filteredConcepts: totalCount,
      },
    };

    if (format === 'csv') {
      const csvHeaders = [
        'ID',
        'Preferred Term',
        'Alternative Terms',
        'Category',
        'Latitude',
        'Longitude',
        'URI',
        'Location Count',
      ];

      const csvRows = [
        csvHeaders.join(','),
        ...paginatedEntries.map((entry) =>
          [
            `"${entry.id}"`,
            `"${entry.preferredTerm}"`,
            `"${entry.alternativeTerms.join('; ')}"`,
            `"${entry.category}"`,
            entry.coordinates?.latitude || '',
            entry.coordinates?.longitude || '',
            `"${entry.uri}"`,
            entry.locations.length,
          ].join(','),
        ),
      ];

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="gavoc-concepts.csv"',
        },
      });
    }

    return NextResponse.json(responseData, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('GAVOC API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve concepts',
      },
      { status: 500 },
    );
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
