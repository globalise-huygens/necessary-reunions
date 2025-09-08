import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

interface GlobalisePlace {
  '@context': string;
  id: string;
  type: string;
  _label: string;
  classified_as?: Array<{
    id: string;
    type: string;
    _label: string;
  }>;
  identified_by: Array<{
    type: string;
    content: string;
    classified_as?: Array<{
      id: string;
      type: string;
      _label: string;
    }>;
  }>;
  referred_to_by?: Array<{
    type: string;
    classified_as: Array<{
      id: string;
      type: string;
      _label: string;
    }>;
    content: string;
  }>;
  part_of?: Array<{
    id: string;
    type: string;
    _label: string;
  }>;
  defined_by: string; // WKT format like "POINT (78.125124 8.564386)"
}

interface SearchResult {
  id: string;
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
  properties: {
    preferredTitle: string;
    title: string;
    alternativeNames: string[];
    type: string;
    types: string[];
    originalDescription?: string;
    context?: string;
  };
}

function parseWKTPoint(wkt: string): [number, number] | null {
  const match = wkt.match(
    /POINT\s*\(\s*([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\s*\)/,
  );
  if (match) {
    return [parseFloat(match[1]), parseFloat(match[2])]; // [longitude, latitude]
  }
  return null;
}

function transformGlobalisePlace(place: GlobalisePlace): SearchResult {
  // Extract preferred and alternative names
  const names = place.identified_by.filter((item) => item.type === 'Name');

  let preferredTitle = place._label;
  const alternativeNames: string[] = [];

  for (const name of names) {
    const isPref = name.classified_as?.some((cls) => cls.id === 'PREF');
    const isAlt = name.classified_as?.some((cls) => cls.id === 'ALT');

    if (isPref) {
      preferredTitle = name.content;
    } else if (isAlt) {
      alternativeNames.push(name.content);
    }
  }

  // Extract place types
  const types: string[] = [];
  if (place.classified_as) {
    for (const classification of place.classified_as) {
      if (classification._label) {
        // Extract the second part after the slash if it exists
        const parts = classification._label.split(' / ');
        if (parts.length > 1) {
          types.push(parts[1]);
        } else {
          types.push(classification._label);
        }
      }
    }
  }

  // Parse coordinates from WKT format
  const coordinates = parseWKTPoint(place.defined_by);

  // Extract context from referred_to_by
  let context = '';
  if (place.referred_to_by && place.referred_to_by.length > 0) {
    context = place.referred_to_by[0].content;
  }

  return {
    id: place.id,
    type: 'Feature',
    geometry: coordinates
      ? {
          type: 'Point',
          coordinates: coordinates,
        }
      : null,
    properties: {
      preferredTitle,
      title: preferredTitle,
      alternativeNames,
      type: types.length > 0 ? types[0] : 'place',
      types,
      originalDescription: context,
      context,
    },
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get('name');

  if (!name) {
    return NextResponse.json(
      { error: 'Name parameter is required' },
      { status: 400 },
    );
  }

  try {
    // Read the local globalise dataset
    const datasetPath = path.join(
      process.cwd(),
      'public',
      'globalise-place-dataset.json',
    );
    const datasetContent = fs.readFileSync(datasetPath, 'utf8');
    const places: GlobalisePlace[] = JSON.parse(datasetContent);

    // Search through the places
    const searchLower = name.toLowerCase();
    const matchingPlaces = places.filter((place) => {
      // Check main label
      if (place._label.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Check all identified names
      const names = place.identified_by.filter((item) => item.type === 'Name');
      for (const nameObj of names) {
        if (nameObj.content.toLowerCase().includes(searchLower)) {
          return true;
        }
      }

      // Check alternative names in context/description
      if (place.referred_to_by) {
        for (const desc of place.referred_to_by) {
          if (desc.content.toLowerCase().includes(searchLower)) {
            return true;
          }
        }
      }

      return false;
    });

    // Transform to the expected format
    const transformedResults = matchingPlaces.map(transformGlobalisePlace);

    // Limit results to 10
    const limitedResults = transformedResults.slice(0, 10);

    return NextResponse.json({
      features: limitedResults,
      source: 'globalise-local',
      query: name,
      totalFound: transformedResults.length,
    });
  } catch (error) {
    console.error('Error reading globalise dataset:', error);
    return NextResponse.json(
      { error: 'Failed to read local globalise dataset' },
      { status: 500 },
    );
  }
}
