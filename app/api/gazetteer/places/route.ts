import { fetchAllPlaces } from '@/lib/gazetteer/data';
import type {
  GazetteerPlace,
  GazetteerSearchResult,
} from '@/lib/gazetteer/types';
import { NextResponse } from 'next/server';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs),
    ),
  ]);
}

// Simple fallback data for testing
async function getFallbackPlaces(): Promise<GazetteerSearchResult> {
  const samplePlaces: GazetteerPlace[] = [
    {
      id: 'sample-1',
      name: 'Cochin',
      alternativeNames: ['Kochi', 'Fort Cochin'],
      category: 'plaats',
      modernName: 'Kochi',
      textRecognitionSources: [
        {
          text: 'Cochin',
          source: 'human',
          created: '2024-01-01',
          targetId: 'target-1',
          isHumanVerified: true,
        },
      ],
      mapInfo: {
        id: 'map-1',
        title: 'Historical Map of Malabar Coast',
        date: '1663',
        canvasId: 'canvas-1',
        permalink: 'https://hdl.handle.net/21.12102/example',
      },
      hasHumanVerification: true,
      targetAnnotationCount: 1,
      isGeotagged: false,
      hasGeotagging: false,
      hasPointSelection: true,
    },
    {
      id: 'sample-2',
      name: 'Calicut',
      alternativeNames: ['Kozhikode', 'Callicut'],
      category: 'plaats',
      modernName: 'Kozhikode',
      textRecognitionSources: [
        {
          text: 'Calicut',
          source: 'loghi-htr',
          created: '2024-01-02',
          targetId: 'target-2',
        },
      ],
      mapInfo: {
        id: 'map-2',
        title: 'Map of Kerala Coast',
        date: '1680',
        canvasId: 'canvas-2',
      },
      hasHumanVerification: false,
      targetAnnotationCount: 2,
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: true,
    },
    {
      id: 'sample-3',
      name: 'Cranganore',
      alternativeNames: ['Kodungallur', 'Cranganor'],
      category: 'plaats',
      modernName: 'Kodungallur',
      description:
        'Ancient port city on the Malabar Coast, historically significant for trade and cultural exchange.',
      textRecognitionSources: [
        {
          text: 'Cranganore',
          source: 'human',
          created: '2024-01-03',
          targetId: 'target-3',
          isHumanVerified: true,
        },
        {
          text: 'Crāganor',
          source: 'loghi-htr',
          created: '2024-01-04',
          targetId: 'target-4',
        },
      ],
      mapInfo: {
        id: 'map-3',
        title: 'Dutch Map of Kerala',
        date: '1695',
        canvasId: 'canvas-3',
        dimensions: { width: 4000, height: 3000 },
      },
      mapReferences: [
        {
          mapId: 'map-ref-1',
          mapTitle: 'Portuguese Map of India',
          canvasId: 'canvas-ref-1',
          gridSquare: 'D4',
          pageNumber: '15',
        },
      ],
      hasHumanVerification: true,
      targetAnnotationCount: 3,
      isGeotagged: false,
      hasGeotagging: false,
      hasPointSelection: true,
    },
  ];

  return {
    places: samplePlaces,
    totalCount: samplePlaces.length,
    hasMore: false,
  };
}

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '50');
    const startsWith = searchParams.get('startsWith') || undefined;
    const category = searchParams.get('category') || undefined;
    const hasCoordinates = searchParams.get('hasCoordinates') === 'true';
    const hasModernName = searchParams.get('hasModernName') === 'true';
    const source = searchParams.get('source') as
      | 'manual'
      | 'ai-generated'
      | 'all'
      | undefined;

    const filter = {
      category,
      hasCoordinates,
      hasModernName,
      source,
    };

    let result: GazetteerSearchResult;

    try {
      // Try the main data source with a shorter timeout
      result = await withTimeout(
        fetchAllPlaces({
          search,
          startsWith,
          page,
          limit,
          filter,
        }),
        8000, // Reduced timeout
      );

      // If we get empty results, try fallback
      if (result.places.length === 0 && !search && !startsWith) {
        console.log('Main data source returned no results, using fallback');
        result = await getFallbackPlaces();
      }
    } catch (error) {
      console.log('Main data source failed, using fallback data');
      result = await getFallbackPlaces();

      // Apply search filter to fallback data
      if (search) {
        const searchLower = search.toLowerCase();
        result.places = result.places.filter(
          (place) =>
            place.name.toLowerCase().includes(searchLower) ||
            place.modernName?.toLowerCase().includes(searchLower) ||
            place.alternativeNames?.some((name) =>
              name.toLowerCase().includes(searchLower),
            ),
        );
        result.totalCount = result.places.length;
      }
    }

    const duration = Date.now() - startTime;

    const response = NextResponse.json({
      ...result,
      source: result.places.length > 3 ? 'annorepo' : 'fallback',
      message:
        result.places.length > 3
          ? 'Data loaded from AnnoRepo'
          : 'Using fallback test data for demonstration',
    });

    response.headers.set(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=120',
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Gazetteer API error after ${duration}ms:`, error);

    // Return empty fallback
    return NextResponse.json(
      {
        error: 'Failed to fetch places',
        places: [],
        totalCount: 0,
        hasMore: false,
        source: 'error',
      },
      { status: 500 },
    );
  }
}
