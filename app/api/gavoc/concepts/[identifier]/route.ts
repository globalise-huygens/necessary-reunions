import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { processGavocData } from '../../../../../lib/gavoc/data-processing';
import type { GavocThesaurusEntry } from '../../../../../lib/gavoc/thesaurus';

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
      console.error('CSV file has no header line');
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

interface ConceptData {
  id: string;
  preferredTerm: string;
  alternativeTerms: string[];
  category: string;
  coordinates: unknown;
  uri: string;
  urlPath: string;
  locations: Array<{
    id: string;
    indexPage: string;
    originalNameOnMap: string;
    presentName: string;
    coordinates: unknown;
    latitude: number | undefined;
    longitude: number | undefined;
    mapGridSquare: string;
    map: string;
    page: string;
    uri: string;
    urlPath: string;
    alternativeNames: string[];
  }>;
  statistics: {
    totalLocations: number;
    locationsWithCoordinates: number;
    uniqueMaps: number;
    dateRange: {
      description: string;
    };
  };
  relatedConcepts: Array<{
    id: string;
    preferredTerm: string;
    uri: string;
    category: string;
  }>;
  metadata: {
    apiVersion: string;
    retrievedAt: string;
    conceptType: string;
  };
}

interface ErrorResponse {
  error: string;
  message?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { identifier: string } },
): Promise<NextResponse<ConceptData | ErrorResponse>> {
  try {
    const entries = await getGavocData();
    const identifier = params.identifier;

    let concept = entries.find((entry) => entry.id === identifier);

    if (!concept) {
      concept = entries.find((entry) => {
        const slug = entry.urlPath.split('/').pop();
        return slug === identifier;
      });
    }

    if (!concept) {
      concept = entries.find(
        (entry) =>
          entry.preferredTerm.toLowerCase().replace(/[^a-z0-9]/g, '-') ===
          identifier.toLowerCase(),
      );
    }

    if (!concept) {
      return NextResponse.json(
        {
          error: 'Concept not found',
          message: `No concept found with identifier: ${identifier}`,
        },
        { status: 404 },
      );
    }

    const conceptData = {
      id: concept.id,
      preferredTerm: concept.preferredTerm,
      alternativeTerms: concept.alternativeTerms,
      category: concept.category,
      coordinates: concept.coordinates,
      uri: concept.uri,
      urlPath: concept.urlPath,
      locations: concept.locations.map((location) => ({
        id: location.id,
        indexPage: location.indexPage,
        originalNameOnMap: location.originalNameOnMap,
        presentName: location.presentName,
        coordinates: location.coordinates,
        latitude: location.latitude,
        longitude: location.longitude,
        mapGridSquare: location.mapGridSquare,
        map: location.map,
        page: location.page,
        uri: location.uri,
        urlPath: location.urlPath,
        alternativeNames: location.alternativeNames,
      })),
      statistics: {
        totalLocations: concept.locations.length,
        locationsWithCoordinates: concept.locations.filter(
          (loc) => loc.hasCoordinates,
        ).length,
        uniqueMaps: [
          ...new Set(concept.locations.map((loc) => loc.map)),
        ].filter(Boolean).length,
        dateRange: {
          description: 'Historical period based on map sources',
        },
      },
      relatedConcepts: entries
        .filter(
          (entry) =>
            entry.id !== concept.id && entry.category === concept.category,
        )
        .slice(0, 5)
        .map((entry) => ({
          id: entry.id,
          preferredTerm: entry.preferredTerm,
          uri: entry.uri,
          category: entry.category,
        })),
      metadata: {
        apiVersion: '1.0',
        retrievedAt: new Date().toISOString(),
        conceptType: 'geographic-entity',
      },
    };

    return NextResponse.json(conceptData as ConceptData, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('GAVOC Concept API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve concept',
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
