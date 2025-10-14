import { processGavocData } from '@/lib/gavoc/data-processing';
import { GavocThesaurusEntry } from '@/lib/gavoc/thesaurus';
import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

let cachedData: {
  entries: GavocThesaurusEntry[];
  lastUpdated: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000;

async function getGavocData() {
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

    const processedData = processGavocData(rawData);

    cachedData = {
      entries: processedData.thesaurus?.entries || [],
      lastUpdated: now,
    };

    return cachedData.entries;
  } catch (error) {
    console.error('Error loading GAVOC data:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entries = await getGavocData();

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
