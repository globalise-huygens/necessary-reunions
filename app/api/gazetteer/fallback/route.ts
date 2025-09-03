import { NextResponse } from 'next/server';

export async function GET() {
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

    const places = gavocData.map((item) => ({
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

    const duration = Date.now() - startTime;

    const result = {
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

function parseGavocCSV(csvText: string): any[] {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',');

  return lines
    .slice(1)
    .map((line) => {
      const values = parseCSVLine(line);
      if (values.length < headers.length) return null;

      const item: any = {};
      headers.forEach((header, index) => {
        const cleanHeader = header.replace(/['"]/g, '').trim();
        item[cleanHeader] = values[index]?.replace(/['"]/g, '').trim() || '';
      });

      if (
        item['Coördinaten/Coordinates'] &&
        item['Coördinaten/Coordinates'] !== '-'
      ) {
        const coords = parseCoordinates(item['Coördinaten/Coordinates']);
        if (coords) {
          item.coordinates = coords;
        }
      }

      if (item['Soortnaam/Category']) {
        item.category = item['Soortnaam/Category'].split('/')[0];
      }

      return item;
    })
    .filter(Boolean);
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

function parseCoordinates(
  coordString: string,
): { lat: number; lng: number } | null {
  const match = coordString.match(/(\d+)-(\d+)([NS])\/(\d+)-(\d+)([EW])/);
  if (!match) return null;

  const [, latDeg, latMin, latDir, lngDeg, lngMin, lngDir] = match;

  let lat = parseInt(latDeg) + parseInt(latMin) / 60;
  let lng = parseInt(lngDeg) + parseInt(lngMin) / 60;

  if (latDir === 'S') lat = -lat;
  if (lngDir === 'W') lng = -lng;

  return { lat, lng };
}
