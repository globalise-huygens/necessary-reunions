import { processGavocData } from '@/lib/gavoc/data-processing';
import { NextRequest, NextResponse } from 'next/server';

let cachedGavocData: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 10 * 60 * 1000;

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
    const gavocData = await getGavocData();

    if (!gavocData?.thesaurus) {
      return NextResponse.json({ error: 'No data available' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('stats') === 'true';

    const categories = Object.entries(gavocData.thesaurus.conceptsByCategory)
      .map(([category, conceptCount]) => {
        const categoryData: any = {
          name: category,
          conceptCount: conceptCount as number,
        };

        if (includeStats) {
          const categoryEntries = gavocData.thesaurus.entries.filter(
            (entry: any) => entry.category === category,
          );

          categoryData.statistics = {
            totalLocations: categoryEntries.reduce(
              (sum: number, entry: any) => sum + entry.locations.length,
              0,
            ),
            entriesWithCoordinates: categoryEntries.filter(
              (entry: any) => entry.coordinates,
            ).length,
            averageLocationsPerConcept: Math.round(
              categoryEntries.reduce(
                (sum: number, entry: any) => sum + entry.locations.length,
                0,
              ) / categoryEntries.length,
            ),
            exampleConcepts: categoryEntries.slice(0, 3).map((entry: any) => ({
              preferredTerm: entry.preferredTerm,
              uri: entry.uri,
            })),
          };
        }

        return categoryData;
      })
      .sort((a, b) => b.conceptCount - a.conceptCount);

    const responseData = {
      categories,
      summary: {
        totalCategories: categories.length,
        totalConcepts: gavocData.thesaurus.totalConcepts,
        totalLocations: gavocData.thesaurus.totalLocations,
        mostPopularCategory: categories[0]?.name || null,
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
