import { createSlugFromName, fetchPlaceBySlug } from '@/lib/gazetteer/data';
import type { GazetteerPlace } from '@/lib/gazetteer/types';
import { NextResponse } from 'next/server';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs),
    ),
  ]);
}

// Simple fallback data matching the main route
function getFallbackPlaceBySlug(slug: string): GazetteerPlace | null {
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

  return (
    samplePlaces.find((place) => createSlugFromName(place.name) === slug) ||
    null
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const startTime = Date.now();

  try {
    const { slug } = await context.params;

    let place: GazetteerPlace | null = null;

    try {
      // Try main data source first
      place = await withTimeout(fetchPlaceBySlug(slug), 8000);
    } catch (error) {
      console.log('Main data source failed for slug, using fallback');
      place = getFallbackPlaceBySlug(slug);
    }

    const duration = Date.now() - startTime;

    if (!place) {
      return NextResponse.json({ error: 'Place not found' }, { status: 404 });
    }

    const response = NextResponse.json(place);
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=600, stale-while-revalidate=1200',
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        { error: 'Request timed out. Please try again later.' },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch place' },
      { status: 500 },
    );
  }
}
