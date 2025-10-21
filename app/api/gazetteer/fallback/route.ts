import { NextResponse } from 'next/server';

interface Coordinates {
  lat: number;
  lng: number;
}

interface GavocItem {
  'Oorspr. naam op de kaart/Original name on the map'?: string;
  'Tegenwoordige naam/Present name'?: string;
  'Coördinaten/Coordinates'?: string;
  'Soortnaam/Category'?: string;
  category?: string;
  coordinates?: Coordinates;
  [key: string]: string | Coordinates | undefined;
}

interface PlaceResult {
  id: string;
  name: string;
  category: string;
  coordinates?: Coordinates;
  modernName?: string;
  textParts: never[];
  targetAnnotationCount: number;
  isGeotagged: boolean;
  hasGeotagging: boolean;
  hasHumanVerification: boolean;
  textRecognitionSources: never[];
  source: string;
}

interface FallbackResponse {
  places: PlaceResult[];
  totalCount: number;
  hasMore: boolean;
  fallback: boolean;
  error?: string;
}

export async function GET(): Promise<NextResponse<FallbackResponse>> {
  const startTime = Date.now();

  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/gavoc-atlas-index.csv`, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch GAVOC data: ${response.status}`);
    }

    const csvText = await response.text();
    const gavocData = parseGavocCSV(csvText);

    const places: PlaceResult[] = gavocData.map((item) => ({
      id: `gavoc-${
        item['Oorspr. naam op de kaart/Original name on the map'] || 'unknown'
      }`,
      name:
        item['Oorspr. naam op de kaart/Original name on the map'] || 'Unknown',
      category: item.category || 'place',
      coordinates: item.coordinates,
      modernName:
        item['Tegenwoordige naam/Present name'] !== '-'
          ? item['Tegenwoordige naam/Present name']
          : undefined,
      textParts: [],
      targetAnnotationCount: 0,
      isGeotagged: !!item.coordinates,
      hasGeotagging: !!item.coordinates,
      hasHumanVerification: true,
      textRecognitionSources: [],
      source: 'gavoc-fallback',
    }));

    const result: FallbackResponse = {
      places: places.slice(0, 200),
      totalCount: places.length,
      hasMore: places.length > 200,
      fallback: true,
    };

    const res = NextResponse.json(result);
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=7200',
    );
    return res;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Emergency fallback failed after ${duration}ms:`, error);

    return NextResponse.json(
      {
        error: 'All data sources failed',
        places: [],
        totalCount: 0,
        hasMore: false,
        fallback: true,
      },
      { status: 500 },
    );
  }
}

function parseGavocCSV(csvText: string): GavocItem[] {
  const lines = csvText.split('\n');
  const firstLine = lines[0];

  if (!firstLine) {
    return [];
  }

  const headers = firstLine.split(',');

  return lines
    .slice(1)
    .map((line): GavocItem | null => {
      const values = parseCSVLine(line);
      if (values.length < headers.length) return null;

      const item: GavocItem = {};
      headers.forEach((header, index) => {
        const cleanHeader = header.replace(/['"]/g, '').trim();
        item[cleanHeader] = values[index]?.replace(/['"]/g, '').trim() || '';
      });

      if (
        item['Coördinaten/Coordinates'] &&
        item['Coördinaten/Coordinates'] !== '-'
      ) {
        const coordString = item['Coördinaten/Coordinates'];
        if (typeof coordString === 'string') {
          const coords = parseCoordinates(coordString);
          if (coords) {
            item.coordinates = coords;
          }
        }
      }

      const categoryValue = item['Soortnaam/Category'];
      if (categoryValue && typeof categoryValue === 'string') {
        const parts = categoryValue.split('/');
        if (parts[0]) {
          item.category = parts[0];
        }
      }

      return item;
    })
    .filter((item): item is GavocItem => item !== null);
}

function parseCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function parseCoordinates(coordString: string): Coordinates | null {
  const match = coordString.match(/(\d+)-(\d+)([NS])\/(\d+)-(\d+)([EW])/);
  if (!match) return null;

  const [, latDeg, latMin, latDir, lngDeg, lngMin, lngDir] = match;

  if (!latDeg || !latMin || !latDir || !lngDeg || !lngMin || !lngDir) {
    return null;
  }

  let lat = parseInt(latDeg, 10) + parseInt(latMin, 10) / 60;
  let lng = parseInt(lngDeg, 10) + parseInt(lngMin, 10) / 60;

  if (latDir === 'S') lat = -lat;
  if (lngDir === 'W') lng = -lng;

  return { lat, lng };
}
