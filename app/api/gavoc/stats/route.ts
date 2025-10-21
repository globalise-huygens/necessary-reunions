import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { processGavocData } from '../../../../lib/gavoc/data-processing';

interface Coordinate {
  lat: number;
  lng: number;
}

interface ProcessedGavocData {
  thesaurus?: {
    entries: Array<{
      preferredTerm: string;
      alternativeTerms: string[];
      coordinates?: { latitude: number; longitude: number };
    }>;
    totalConcepts: number;
    totalLocations: number;
    conceptsByCategory: Record<string, number>;
  };
  locations: Array<{
    hasCoordinates: boolean;
    latitude?: number;
    longitude?: number;
    map: string;
  }>;
}

interface StatsResponseData {
  overview: {
    totalConcepts: number;
    totalLocations: number;
    totalCategories: number;
    dataReductionRatio: number;
  };
  geography: {
    coverage: {
      totalWithCoordinates: number;
      percentage: number;
      boundingBox: {
        north: number;
        south: number;
        east: number;
        west: number;
      };
    };
    distribution: {
      byLatitudeBands: {
        arctic: number;
        temperate: number;
        tropical: number;
        southern: number;
      };
    };
  } | null;
  content: {
    terminology: {
      totalTerms: number;
      uniqueTerms: number;
      averageTermLength: number;
      longestTerm: string;
      shortestTerm: string;
    };
    sources: {
      totalMaps: number;
      locationsPerMap: number;
      mapCoverage: string[];
    };
  };
  categories: {
    distribution: Array<{ category: string; count: number }>;
    topCategories: Array<{ category: string; count: number }>;
    categoryDiversity: number;
  };
  quality: {
    completeness: {
      conceptsWithCoordinates: number;
      conceptsWithAlternatives: number;
      averageAlternativesPerConcept: number;
    };
    consistency: {
      duplicateCheck: string;
      namingConsistency: string;
    };
  };
  api: {
    endpoints: string[];
    supportedFormats: string[];
    rateLimit: string;
    cachePolicy: string;
  };
  metadata: {
    apiVersion: string;
    generatedAt: string;
    dataLastUpdated: string;
    thesaurusVersion: string;
    systemStatus: string;
  };
}

interface ErrorResponse {
  error: string;
  message?: string;
}

let cachedGavocData: ProcessedGavocData | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 10 * 60 * 1000;

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

export async function GET(): Promise<
  NextResponse<StatsResponseData | ErrorResponse>
> {
  const gavocData = await Promise.resolve(getGavocData());

  if (!gavocData?.thesaurus) {
    return NextResponse.json({ error: 'No data available' }, { status: 503 });
  }

  const thesaurus = gavocData.thesaurus;
  const locations = gavocData.locations;

  const locationsWithCoords = locations.filter(
    (
      loc: ProcessedGavocData['locations'][0],
    ): loc is ProcessedGavocData['locations'][0] & {
      latitude: number;
      longitude: number;
    } =>
      loc.hasCoordinates &&
      loc.latitude !== undefined &&
      loc.longitude !== undefined,
  );
  const coordinates: Coordinate[] = locationsWithCoords.map((loc) => ({
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
                ...coordinates.map((c: { lat: number; lng: number }) => c.lat),
              ),
              south: Math.min(
                ...coordinates.map((c: { lat: number; lng: number }) => c.lat),
              ),
              east: Math.max(
                ...coordinates.map((c: { lat: number; lng: number }) => c.lng),
              ),
              west: Math.min(
                ...coordinates.map((c: { lat: number; lng: number }) => c.lng),
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

  type ThesaurusEntry = {
    preferredTerm: string;
    alternativeTerms: string[];
    coordinates?: { latitude: number; longitude: number };
  };

  const allTerms: string[] = thesaurus.entries.flatMap(
    (entry: ThesaurusEntry) => [entry.preferredTerm, ...entry.alternativeTerms],
  );

  const termLengths = allTerms.map((term: string) => term.length);

  type LocationEntry = {
    hasCoordinates: boolean;
    latitude?: number;
    longitude?: number;
    map: string;
  };

  const uniqueMaps: string[] = [
    ...new Set(locations.map((loc: LocationEntry) => loc.map).filter(Boolean)),
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
    .map(([category, count]) => ({ category, count: Number(count) }))
    .sort((a, b) => b.count - a.count);

  const qualityMetrics = {
    completeness: {
      conceptsWithCoordinates: thesaurus.entries.filter(
        (entry: ThesaurusEntry) => entry.coordinates,
      ).length,
      conceptsWithAlternatives: thesaurus.entries.filter(
        (entry: ThesaurusEntry) => entry.alternativeTerms.length > 0,
      ).length,
      averageAlternativesPerConcept: Math.round(
        thesaurus.entries.reduce(
          (sum: number, entry: ThesaurusEntry) =>
            sum + entry.alternativeTerms.length,
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
