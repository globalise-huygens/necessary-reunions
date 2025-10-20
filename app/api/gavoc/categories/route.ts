import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { processGavocData } from '../../../../lib/gavoc/data-processing';

interface GavocEntry {
  category: string;
  locations: unknown[];
  coordinates?: unknown;
  preferredTerm: string;
  uri: string;
  [key: string]: unknown;
}

interface GavocThesaurus {
  conceptsByCategory: Record<string, number>;
  entries: GavocEntry[];
  totalConcepts: number;
  totalLocations: number;
}

interface GavocData {
  thesaurus: GavocThesaurus;
  [key: string]: unknown;
}

interface CategoryData {
  name: string;
  conceptCount: number;
  statistics?: {
    totalLocations: number;
    entriesWithCoordinates: number;
    averageLocationsPerConcept: number;
    exampleConcepts: Array<{
      preferredTerm: string;
      uri: string;
    }>;
  };
}

interface ResponseData {
  categories: CategoryData[];
  summary: {
    totalCategories: number;
    totalConcepts: number;
    totalLocations: number;
    mostPopularCategory: string | null;
    distributionStats: {
      averageConceptsPerCategory: number;
      largestCategory: {
        name?: string;
        conceptCount?: number;
      };
      smallestCategory: {
        name?: string;
        conceptCount?: number;
      };
    };
  };
  metadata: {
    apiVersion: string;
    generatedAt: string;
    includeStatistics: boolean;
  };
}

interface ErrorResponse {
  error: string;
  message?: string;
}

let cachedGavocData: GavocData | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 10 * 60 * 1000;

function getGavocData(): GavocData | null {
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
      console.error('CSV file has no header line');
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

    const processedData = processGavocData(rawData);
    if (processedData.thesaurus) {
      cachedGavocData = processedData as unknown as GavocData;
      cacheTimestamp = now;
    }

    return cachedGavocData;
  } catch (error) {
    console.error('Error loading GAVOC data:', error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ResponseData | ErrorResponse>> {
  try {
    const gavocData = await getGavocData();

    if (!gavocData?.thesaurus) {
      return NextResponse.json({ error: 'No data available' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('stats') === 'true';

    const categories: CategoryData[] = Object.entries(
      gavocData.thesaurus.conceptsByCategory,
    )
      .map(([category, conceptCount]): CategoryData => {
        const categoryData: CategoryData = {
          name: category,
          conceptCount: conceptCount,
        };

        if (includeStats) {
          const categoryEntries = gavocData.thesaurus.entries.filter(
            (entry) => entry.category === category,
          );

          categoryData.statistics = {
            totalLocations: categoryEntries.reduce(
              (sum, entry) => sum + entry.locations.length,
              0,
            ),
            entriesWithCoordinates: categoryEntries.filter(
              (entry) => entry.coordinates,
            ).length,
            averageLocationsPerConcept: Math.round(
              categoryEntries.reduce(
                (sum, entry) => sum + entry.locations.length,
                0,
              ) / categoryEntries.length,
            ),
            exampleConcepts: categoryEntries.slice(0, 3).map((entry) => ({
              preferredTerm: entry.preferredTerm,
              uri: entry.uri,
            })),
          };
        }

        return categoryData;
      })
      .sort((a, b) => b.conceptCount - a.conceptCount);

    const responseData: ResponseData = {
      categories,
      summary: {
        totalCategories: categories.length,
        totalConcepts: gavocData.thesaurus.totalConcepts,
        totalLocations: gavocData.thesaurus.totalLocations,
        mostPopularCategory: categories[0]?.name ?? null,
        distributionStats: {
          averageConceptsPerCategory: Math.round(
            gavocData.thesaurus.totalConcepts / categories.length,
          ),
          largestCategory: {
            name: categories[0]?.name,
            conceptCount: categories[0]?.conceptCount,
          },
          smallestCategory: {
            name: categories[categories.length - 1]?.name,
            conceptCount: categories[categories.length - 1]?.conceptCount,
          },
        },
      },
      metadata: {
        apiVersion: '1.0',
        generatedAt: new Date().toISOString(),
        includeStatistics: includeStats,
      },
    };

    return NextResponse.json(responseData, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (error) {
    console.error('GAVOC Categories API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve categories',
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
