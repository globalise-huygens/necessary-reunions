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

// Comprehensive fallback data for testing
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
    {
      id: 'sample-4',
      name: 'Quilon',
      alternativeNames: ['Kollam', 'Coulão'],
      category: 'plaats',
      modernName: 'Kollam',
      description:
        'Historic port city, known for cashew processing and spice trade.',
      textRecognitionSources: [
        {
          text: 'Quilon',
          source: 'human',
          created: '2024-01-05',
          targetId: 'target-5',
          isHumanVerified: true,
        },
      ],
      mapInfo: {
        id: 'map-4',
        title: 'Portuguese Map of Malabar',
        date: '1650',
        canvasId: 'canvas-4',
      },
      hasHumanVerification: true,
      targetAnnotationCount: 1,
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: true,
    },
    {
      id: 'sample-5',
      name: 'Cannanore',
      alternativeNames: ['Kannur', 'Cananor'],
      category: 'plaats',
      modernName: 'Kannur',
      description: 'Coastal city known for its beaches and historic forts.',
      textRecognitionSources: [
        {
          text: 'Cannanore',
          source: 'loghi-htr',
          created: '2024-01-06',
          targetId: 'target-6',
        },
      ],
      mapInfo: {
        id: 'map-5',
        title: 'English Map of Kerala',
        date: '1720',
        canvasId: 'canvas-5',
      },
      hasHumanVerification: false,
      targetAnnotationCount: 1,
      isGeotagged: false,
      hasGeotagging: false,
      hasPointSelection: true,
    },
    {
      id: 'sample-6',
      name: 'Tellicherry',
      alternativeNames: ['Thalassery'],
      category: 'plaats',
      modernName: 'Thalassery',
      description: 'Former British settlement, famous for spice trade.',
      textRecognitionSources: [
        {
          text: 'Tellicherry',
          source: 'human',
          created: '2024-01-07',
          targetId: 'target-7',
          isHumanVerified: true,
        },
      ],
      mapInfo: {
        id: 'map-6',
        title: 'British India Survey Map',
        date: '1740',
        canvasId: 'canvas-6',
      },
      hasHumanVerification: true,
      targetAnnotationCount: 1,
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: false,
    },
    {
      id: 'sample-7',
      name: 'Malabar River',
      alternativeNames: ['Rio Malabar'],
      category: 'rivier',
      textRecognitionSources: [
        {
          text: 'Malabar River',
          source: 'loghi-htr',
          created: '2024-01-08',
          targetId: 'target-8',
        },
      ],
      mapInfo: {
        id: 'map-7',
        title: 'Hydrographic Map of Kerala',
        date: '1670',
        canvasId: 'canvas-7',
      },
      hasHumanVerification: false,
      targetAnnotationCount: 1,
      isGeotagged: false,
      hasGeotagging: false,
      hasPointSelection: true,
    },
    {
      id: 'sample-8',
      name: 'Cape Comorin',
      alternativeNames: ['Kanyakumari', 'Cabo Comorin'],
      category: 'kaap',
      modernName: 'Kanyakumari',
      description: 'Southernmost tip of the Indian subcontinent.',
      textRecognitionSources: [
        {
          text: 'Cape Comorin',
          source: 'human',
          created: '2024-01-09',
          targetId: 'target-9',
          isHumanVerified: true,
        },
      ],
      mapInfo: {
        id: 'map-8',
        title: 'Map of Southern India',
        date: '1685',
        canvasId: 'canvas-8',
        permalink: 'https://hdl.handle.net/21.12102/comorin',
      },
      hasHumanVerification: true,
      targetAnnotationCount: 1,
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: true,
    },
    {
      id: 'sample-9',
      name: 'Travancore',
      alternativeNames: ['Thiruvithamkoor'],
      category: 'landstreek',
      modernName: 'Southern Kerala',
      description: 'Historic kingdom in southern Kerala.',
      textRecognitionSources: [
        {
          text: 'Travancore',
          source: 'human',
          created: '2024-01-10',
          targetId: 'target-10',
          isHumanVerified: true,
        },
      ],
      mapInfo: {
        id: 'map-9',
        title: 'Map of Indian Kingdoms',
        date: '1700',
        canvasId: 'canvas-9',
      },
      hasHumanVerification: true,
      targetAnnotationCount: 2,
      isGeotagged: false,
      hasGeotagging: false,
      hasPointSelection: false,
    },
    {
      id: 'sample-10',
      name: 'Backwaters',
      alternativeNames: ['Kerala Backwaters'],
      category: 'meer',
      textRecognitionSources: [
        {
          text: 'Backwaters',
          source: 'loghi-htr',
          created: '2024-01-11',
          targetId: 'target-11',
        },
      ],
      mapInfo: {
        id: 'map-10',
        title: 'Coastal Map of Kerala',
        date: '1690',
        canvasId: 'canvas-10',
      },
      hasHumanVerification: false,
      targetAnnotationCount: 1,
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: true,
    },
    {
      id: 'sample-11',
      name: 'Alleppey',
      alternativeNames: ['Alappuzha'],
      category: 'plaats',
      modernName: 'Alappuzha',
      description: 'Venice of the East, famous for backwaters and houseboats.',
      textRecognitionSources: [
        {
          text: 'Alleppey',
          source: 'human',
          created: '2024-01-12',
          targetId: 'target-12',
          isHumanVerified: true,
        },
      ],
      mapInfo: {
        id: 'map-11',
        title: 'Detailed Map of Central Kerala',
        date: '1710',
        canvasId: 'canvas-11',
      },
      hasHumanVerification: true,
      targetAnnotationCount: 1,
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: true,
    },
    {
      id: 'sample-12',
      name: 'Malabar Coast',
      alternativeNames: ['Costa do Malabar'],
      category: 'kust',
      textRecognitionSources: [
        {
          text: 'Malabar Coast',
          source: 'loghi-htr',
          created: '2024-01-13',
          targetId: 'target-13',
        },
      ],
      mapInfo: {
        id: 'map-12',
        title: 'Coastal Survey of Western India',
        date: '1675',
        canvasId: 'canvas-12',
      },
      hasHumanVerification: false,
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
