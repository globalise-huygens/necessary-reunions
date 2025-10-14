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

async function getFallbackPlaces(): Promise<GazetteerSearchResult> {
  const samplePlaces: GazetteerPlace[] = [
    {
      id: 'sample-1',
      name: 'Cochin',
      alternativeNames: ['Kochi', 'Fort Cochin'],
      category: 'plaats',
      modernName: 'Kochi',
      coordinates: { x: 76.2673, y: 9.9312 },
      coordinateType: 'geographic',
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
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: true,
    },
    {
      id: 'sample-2',
      name: 'Calicut',
      alternativeNames: ['Kozhikode', 'Callicut'],
      category: 'plaats',
      modernName: 'Kozhikode',
      coordinates: { x: 75.7804, y: 11.2588 },
      coordinateType: 'geographic',
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
      coordinates: { x: 76.2144, y: 10.2253 },
      coordinateType: 'geographic',
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
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: true,
    },
    {
      id: 'sample-4',
      name: 'Quilon',
      alternativeNames: ['Kollam', 'Coulão'],
      category: 'plaats',
      modernName: 'Kollam',
      coordinates: { x: 76.6413, y: 8.8932 },
      coordinateType: 'geographic',
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
      coordinates: { x: 75.3704, y: 11.8745 },
      coordinateType: 'geographic',
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
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: true,
    },
    {
      id: 'sample-6',
      name: 'Tellicherry',
      alternativeNames: ['Thalassery'],
      category: 'plaats',
      modernName: 'Thalassery',
      coordinates: { x: 75.4868, y: 11.748 },
      coordinateType: 'geographic',
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
      hasPointSelection: true,
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
      coordinates: { x: 77.5385, y: 8.0883 },
      coordinateType: 'geographic',
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
      coordinates: { x: 76.3388, y: 9.4981 },
      coordinateType: 'geographic',
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
    {
      id: 'sample-13',
      name: 'Ponnani',
      alternativeNames: ['Ponani'],
      category: 'plaats',
      modernName: 'Ponnani',
      coordinates: { x: 75.9259, y: 10.77 },
      coordinateType: 'geographic',
      description: 'Historic port town and center of Islamic learning.',
      textRecognitionSources: [
        {
          text: 'Ponnani',
          source: 'human',
          created: '2024-01-14',
          targetId: 'target-14',
          isHumanVerified: true,
        },
      ],
      mapInfo: {
        id: 'map-13',
        title: 'Dutch Map of Central Kerala',
        date: '1705',
        canvasId: 'canvas-13',
      },
      hasHumanVerification: true,
      targetAnnotationCount: 1,
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: true,
    },
    {
      id: 'sample-14',
      name: 'Negapatam',
      alternativeNames: ['Nagapattinam'],
      category: 'plaats',
      modernName: 'Nagapattinam',
      description: 'Ancient port city on the Coromandel Coast.',
      textRecognitionSources: [
        {
          text: 'Negapatam',
          source: 'loghi-htr',
          created: '2024-01-15',
          targetId: 'target-15',
        },
      ],
      mapInfo: {
        id: 'map-14',
        title: 'Tamil Coast Survey',
        date: '1660',
        canvasId: 'canvas-14',
      },
      hasHumanVerification: false,
      targetAnnotationCount: 1,
      isGeotagged: false,
      hasGeotagging: false,
      hasPointSelection: true,
    },
    {
      id: 'sample-15',
      name: 'Western Ghats',
      alternativeNames: ['Sahyadri Mountains'],
      category: 'gebergte',
      description:
        'Mountain range running parallel to the western coast of India.',
      textRecognitionSources: [
        {
          text: 'Western Ghats',
          source: 'human',
          created: '2024-01-16',
          targetId: 'target-16',
          isHumanVerified: true,
        },
      ],
      mapInfo: {
        id: 'map-15',
        title: 'Topographical Map of Southern India',
        date: '1730',
        canvasId: 'canvas-15',
      },
      hasHumanVerification: true,
      targetAnnotationCount: 2,
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: false,
    },
    {
      id: 'sample-16',
      name: 'Periyar River',
      alternativeNames: ['River Periyar'],
      category: 'rivier',
      description:
        'Longest river in Kerala, flowing through the Western Ghats.',
      textRecognitionSources: [
        {
          text: 'Periyar River',
          source: 'loghi-htr',
          created: '2024-01-17',
          targetId: 'target-17',
        },
      ],
      mapInfo: {
        id: 'map-16',
        title: 'River Systems of Kerala',
        date: '1695',
        canvasId: 'canvas-16',
      },
      hasHumanVerification: false,
      targetAnnotationCount: 1,
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: true,
    },
    {
      id: 'sample-17',
      name: 'Munnar',
      alternativeNames: ['Munar'],
      category: 'plaats',
      modernName: 'Munnar',
      coordinates: { x: 77.0598, y: 10.0889 },
      coordinateType: 'geographic',
      description:
        'Hill station in the Western Ghats, known for tea plantations.',
      textRecognitionSources: [
        {
          text: 'Munnar',
          source: 'human',
          created: '2024-01-18',
          targetId: 'target-18',
          isHumanVerified: true,
        },
      ],
      mapInfo: {
        id: 'map-17',
        title: 'Highland Survey Map',
        date: '1750',
        canvasId: 'canvas-17',
      },
      hasHumanVerification: true,
      targetAnnotationCount: 1,
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: true,
    },
    {
      id: 'sample-18',
      name: 'Vembanad Lake',
      alternativeNames: ['Vembanad Kayal'],
      category: 'meer',
      coordinates: { x: 76.4, y: 9.6 },
      coordinateType: 'geographic',
      description: 'Largest lake in Kerala and longest lake in India.',
      textRecognitionSources: [
        {
          text: 'Vembanad Lake',
          source: 'loghi-htr',
          created: '2024-01-19',
          targetId: 'target-19',
        },
      ],
      mapInfo: {
        id: 'map-18',
        title: 'Inland Water Bodies of Kerala',
        date: '1680',
        canvasId: 'canvas-18',
      },
      hasHumanVerification: false,
      targetAnnotationCount: 1,
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: true,
    },
    {
      id: 'sample-19',
      name: 'Malabar',
      alternativeNames: ['Costa de Malabar'],
      category: 'landstreek',
      description: 'Historical region of northern Kerala.',
      textRecognitionSources: [
        {
          text: 'Malabar',
          source: 'human',
          created: '2024-01-20',
          targetId: 'target-20',
          isHumanVerified: true,
        },
      ],
      mapInfo: {
        id: 'map-19',
        title: 'Regional Map of Malabar',
        date: '1665',
        canvasId: 'canvas-19',
        permalink: 'https://hdl.handle.net/21.12102/malabar',
      },
      hasHumanVerification: true,
      targetAnnotationCount: 3,
      isGeotagged: false,
      hasGeotagging: false,
      hasPointSelection: false,
    },
    {
      id: 'sample-20',
      name: 'Thrissur',
      alternativeNames: ['Trichur'],
      category: 'plaats',
      modernName: 'Thrissur',
      coordinates: { x: 76.2144, y: 10.5276 },
      coordinateType: 'geographic',
      description: 'Cultural capital of Kerala, known for its temples.',
      textRecognitionSources: [
        {
          text: 'Thrissur',
          source: 'human',
          created: '2024-01-21',
          targetId: 'target-21',
          isHumanVerified: true,
        },
      ],
      mapInfo: {
        id: 'map-20',
        title: 'Central Kerala Administrative Map',
        date: '1715',
        canvasId: 'canvas-20',
      },
      hasHumanVerification: true,
      targetAnnotationCount: 1,
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: true,
    },
    {
      id: 'sample-21',
      name: 'Beypore',
      alternativeNames: ['Beypur'],
      category: 'plaats',
      modernName: 'Beypore',
      description: 'Historic port town famous for shipbuilding.',
      textRecognitionSources: [
        {
          text: 'Beypore',
          source: 'loghi-htr',
          created: '2024-01-22',
          targetId: 'target-22',
        },
      ],
      mapInfo: {
        id: 'map-21',
        title: 'Ports of Northern Kerala',
        date: '1690',
        canvasId: 'canvas-21',
      },
      hasHumanVerification: false,
      targetAnnotationCount: 1,
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: true,
    },
    {
      id: 'sample-22',
      name: 'Palakkad Gap',
      alternativeNames: ['Palghat Gap'],
      category: 'bergpas',
      modernName: 'Palakkad Gap',
      description:
        'Mountain pass in the Western Ghats connecting Kerala and Tamil Nadu.',
      textRecognitionSources: [
        {
          text: 'Palakkad Gap',
          source: 'human',
          created: '2024-01-23',
          targetId: 'target-23',
          isHumanVerified: true,
        },
      ],
      mapInfo: {
        id: 'map-22',
        title: 'Mountain Passes of South India',
        date: '1745',
        canvasId: 'canvas-22',
      },
      hasHumanVerification: true,
      targetAnnotationCount: 1,
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: true,
    },
    {
      id: 'sample-23',
      name: 'Cardamom Hills',
      alternativeNames: ['Elamalai'],
      category: 'gebergte',
      description: 'Part of the Western Ghats known for spice cultivation.',
      textRecognitionSources: [
        {
          text: 'Cardamom Hills',
          source: 'loghi-htr',
          created: '2024-01-24',
          targetId: 'target-24',
        },
      ],
      mapInfo: {
        id: 'map-23',
        title: 'Spice Growing Regions Map',
        date: '1735',
        canvasId: 'canvas-23',
      },
      hasHumanVerification: false,
      targetAnnotationCount: 1,
      isGeotagged: false,
      hasGeotagging: false,
      hasPointSelection: true,
    },
    {
      id: 'sample-24',
      name: 'Kuttanad',
      alternativeNames: ['Rice Bowl of Kerala'],
      category: 'landstreek',
      description:
        'Low-lying region known for rice cultivation below sea level.',
      textRecognitionSources: [
        {
          text: 'Kuttanad',
          source: 'human',
          created: '2024-01-25',
          targetId: 'target-25',
          isHumanVerified: true,
        },
      ],
      mapInfo: {
        id: 'map-24',
        title: 'Agricultural Regions of Kerala',
        date: '1720',
        canvasId: 'canvas-24',
      },
      hasHumanVerification: true,
      targetAnnotationCount: 2,
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: false,
    },
    {
      id: 'sample-25',
      name: 'Chavakad',
      alternativeNames: ['Chavakkad'],
      category: 'plaats',
      modernName: 'Chavakkad',
      description:
        'Coastal town known for its beach and historical significance.',
      textRecognitionSources: [
        {
          text: 'Chavakad',
          source: 'loghi-htr',
          created: '2024-01-26',
          targetId: 'target-26',
        },
      ],
      mapInfo: {
        id: 'map-25',
        title: 'Coastal Settlements Map',
        date: '1685',
        canvasId: 'canvas-25',
      },
      hasHumanVerification: false,
      targetAnnotationCount: 1,
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: true,
    },
    {
      id: 'sample-26',
      name: 'Valapattanam River',
      alternativeNames: ['Valapatanam'],
      category: 'rivier',
      description:
        'River flowing through northern Kerala into the Arabian Sea.',
      textRecognitionSources: [
        {
          text: 'Valapattanam',
          source: 'human',
          created: '2024-01-27',
          targetId: 'target-27',
          isHumanVerified: true,
        },
      ],
      mapInfo: {
        id: 'map-26',
        title: 'Northern Kerala River Systems',
        date: '1670',
        canvasId: 'canvas-26',
      },
      hasHumanVerification: true,
      targetAnnotationCount: 1,
      isGeotagged: true,
      hasGeotagging: true,
      hasPointSelection: true,
    },
    {
      id: 'sample-27',
      name: 'Silent Valley',
      alternativeNames: ['Sairandhri'],
      category: 'dal',
      description:
        'Protected valley in the Western Ghats with unique biodiversity.',
      textRecognitionSources: [
        {
          text: 'Silent Valley',
          source: 'loghi-htr',
          created: '2024-01-28',
          targetId: 'target-28',
        },
      ],
      mapInfo: {
        id: 'map-27',
        title: 'Forest Regions Survey',
        date: '1760',
        canvasId: 'canvas-27',
      },
      hasHumanVerification: false,
      targetAnnotationCount: 1,
      isGeotagged: false,
      hasGeotagging: false,
      hasPointSelection: true,
    },
    {
      id: 'sample-28',
      name: 'Mattancherry',
      alternativeNames: ['Mattancheri'],
      category: 'plaats',
      modernName: 'Mattancherry',
      description: 'Historic spice trading center and Jewish quarter in Kochi.',
      textRecognitionSources: [
        {
          text: 'Mattancherry',
          source: 'human',
          created: '2024-01-29',
          targetId: 'target-29',
          isHumanVerified: true,
        },
      ],
      mapInfo: {
        id: 'map-28',
        title: 'Detailed Map of Cochin Harbor',
        date: '1678',
        canvasId: 'canvas-28',
        dimensions: { width: 3500, height: 2800 },
      },
      mapReferences: [
        {
          mapId: 'map-ref-2',
          mapTitle: 'Dutch Trading Posts in India',
          canvasId: 'canvas-ref-2',
          gridSquare: 'C3',
          pageNumber: '8',
        },
      ],
      hasHumanVerification: true,
      targetAnnotationCount: 2,
      isGeotagged: true,
      hasGeotagging: true,
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

    result = await fetchAllPlaces({
      search,
      startsWith,
      page,
      limit,
      filter,
    });

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

    const duration = Date.now() - startTime;

    const response = NextResponse.json({
      ...result,
      source: result.places.length <= 28 ? 'fallback' : 'annorepo',
      message:
        result.places.length <= 28
          ? 'Using fallback test data - external API unavailable'
          : `Successfully loaded ${result.places.length} real places from AnnoRepo`,
    });

    response.headers.set(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=120',
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Gazetteer API error after ${duration}ms:`, error);

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
