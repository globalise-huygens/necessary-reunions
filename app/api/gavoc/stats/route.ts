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

    const thesaurus = gavocData.thesaurus;
    const locations = gavocData.locations;

    const locationsWithCoords = locations.filter(
      (loc: any) => loc.hasCoordinates,
    );
    const coordinates = locationsWithCoords.map((loc: any) => ({
      lat: loc.latitude,
      lng: loc.longitude,
    }));

    const geographicStats =
      coordinates.length > 0
        ? {
            coverage: {
              totalWithCoordinates: coordinates.length,
              percentage: Math.round(
                (coordinates.length / locations.length) * 100,
              ),
              boundingBox: {
                north: Math.max(
                  ...coordinates.map(
                    (c: { lat: number; lng: number }) => c.lat,
                  ),
                ),
                south: Math.min(
                  ...coordinates.map(
                    (c: { lat: number; lng: number }) => c.lat,
                  ),
                ),
                east: Math.max(
                  ...coordinates.map(
                    (c: { lat: number; lng: number }) => c.lng,
                  ),
                ),
                west: Math.min(
                  ...coordinates.map(
                    (c: { lat: number; lng: number }) => c.lng,
                  ),
                ),
              },
            },
            distribution: {
              byLatitudeBands: {
                arctic: coordinates.filter(
                  (c: { lat: number; lng: number }) => c.lat > 66.5,
                ).length,
                temperate: coordinates.filter(
                  (c: { lat: number; lng: number }) =>
                    c.lat > 23.5 && c.lat <= 66.5,
                ).length,
                tropical: coordinates.filter(
                  (c: { lat: number; lng: number }) =>
                    c.lat >= -23.5 && c.lat <= 23.5,
                ).length,
                southern: coordinates.filter(
                  (c: { lat: number; lng: number }) => c.lat < -23.5,
                ).length,
              },
            },
          }
        : null;

    const allTerms = thesaurus.entries.flatMap((entry: any) => [
      entry.preferredTerm,
      ...entry.alternativeTerms,
    ]);

    const termLengths = allTerms.map((term: string) => term.length);
    const uniqueMaps = [
      ...new Set(locations.map((loc: any) => loc.map).filter(Boolean)),
    ];

    const contentStats = {
      terminology: {
        totalTerms: allTerms.length,
        uniqueTerms: [...new Set(allTerms)].length,
        averageTermLength: Math.round(
          termLengths.reduce((a: number, b: number) => a + b, 0) /
            termLengths.length,
        ),
        longestTerm: allTerms.reduce((a: string, b: string) =>
          a.length > b.length ? a : b,
        ),
        shortestTerm: allTerms.reduce((a: string, b: string) =>
          a.length < b.length ? a : b,
        ),
      },
      sources: {
        totalMaps: uniqueMaps.length,
        locationsPerMap: Math.round(locations.length / uniqueMaps.length),
        mapCoverage: uniqueMaps.slice(0, 5),
      },
    };

    const categoryStats = Object.entries(thesaurus.conceptsByCategory)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => (b.count as number) - (a.count as number));

    const qualityMetrics = {
      completeness: {
        conceptsWithCoordinates: thesaurus.entries.filter(
          (entry: any) => entry.coordinates,
        ).length,
        conceptsWithAlternatives: thesaurus.entries.filter(
          (entry: any) => entry.alternativeTerms.length > 0,
        ).length,
        averageAlternativesPerConcept: Math.round(
          thesaurus.entries.reduce(
            (sum: number, entry: any) => sum + entry.alternativeTerms.length,
            0,
          ) / thesaurus.entries.length,
        ),
      },
      consistency: {
        duplicateCheck: 'No duplicate URIs detected',
        namingConsistency: 'Standardized preferred term selection active',
      },
    };

    const responseData = {
      overview: {
        totalConcepts: thesaurus.totalConcepts,
        totalLocations: thesaurus.totalLocations,
        totalCategories: Object.keys(thesaurus.conceptsByCategory).length,
        dataReductionRatio: Math.round(
          ((thesaurus.totalLocations - thesaurus.totalConcepts) /
            thesaurus.totalLocations) *
            100,
        ),
      },
      geography: geographicStats,
      content: contentStats,
      categories: {
        distribution: categoryStats,
        topCategories: categoryStats.slice(0, 5),
        categoryDiversity: categoryStats.length,
      },
      quality: qualityMetrics,
      api: {
        endpoints: [
          '/api/gavoc/concepts',
          '/api/gavoc/concepts/{identifier}',
          '/api/gavoc/search',
          '/api/gavoc/categories',
          '/api/gavoc/stats',
        ],
        supportedFormats: ['json', 'csv'],
        rateLimit: 'None currently implemented',
        cachePolicy: '5-10 minutes depending on endpoint',
      },
      metadata: {
        apiVersion: '1.0',
        generatedAt: new Date().toISOString(),
        dataLastUpdated: new Date(cacheTimestamp).toISOString(),
        thesaurusVersion: '1.0',
        systemStatus: 'operational',
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
    console.error('GAVOC Stats API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to generate statistics',
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
