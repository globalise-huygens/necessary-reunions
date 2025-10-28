// Use Netlify Edge Functions for longer timeout
export const runtime = 'edge';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const REQUEST_TIMEOUT = 3500; // 3.5 seconds - conservative for Netlify
const CONCURRENT_TARGET_FETCHES = 10; // Fetch targets in parallel

interface LinkingAnnotation {
  id: string;
  target: string | string[];
  body?: AnnotationBody | AnnotationBody[];
  motivation?: string;
  creator?: any;
  created?: string;
  modified?: string;
  [key: string]: unknown;
}

interface AnnotationBody {
  purpose?: string;
  source?: any;
  selector?: any;
  value?: string;
  [key: string]: unknown;
}

interface ProcessedPlace {
  id: string;
  name: string;
  category: string;
  coordinates?: { x: number; y: number };
  coordinateType?: 'geographic' | 'pixel';
  modernName?: string;
  alternativeNames?: string[];
  linkingAnnotationId: string;
  textParts?: Array<{ value: string; source: string; targetId: string }>;
  isGeotagged?: boolean;
  hasPointSelection?: boolean;
  hasGeotagging?: boolean;
  hasHumanVerification?: boolean;
}

interface BulkResponse {
  places: ProcessedPlace[];
  page: number;
  hasMore: boolean;
  count: number;
  rawAnnotationCount: number;
  error?: string;
}

function jsonResponse(body: BulkResponse, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

async function fetchTargetAnnotation(
  targetId: string,
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(targetId, {
      headers: {
        Accept: '*/*',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as Record<string, unknown>;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

// Type guards for annotation body properties
interface GeotaggingSource {
  uri?: string;
  id?: string;
  preferredTerm?: string;
  label?: string;
  category?: string;
  alternativeTerms?: string[];
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    title?: string;
    category?: string;
    lat?: string;
    lon?: string;
    display_name?: string;
    alternativeTerms?: string[];
  };
}

interface IdentifyingSource {
  uri?: string;
  id?: string;
  preferredTerm?: string;
  label?: string;
  category?: string;
  alternativeTerms?: string[];
}

interface PointSelector {
  type: 'PointSelector';
  x: number;
  y: number;
}

interface BodyWithSource extends Record<string, unknown> {
  source?: GeotaggingSource | IdentifyingSource;
}

interface BodyWithSelector extends Record<string, unknown> {
  selector?: PointSelector;
}

/**
 * Process a batch of linking annotations into places
 */
async function processLinkingAnnotations(
  annotations: LinkingAnnotation[],
): Promise<ProcessedPlace[]> {
  const placeMap = new Map<string, ProcessedPlace>();

  for (const linkingAnnotation of annotations) {
    if (!linkingAnnotation.target || !Array.isArray(linkingAnnotation.target)) {
      continue;
    }

    const bodies = Array.isArray(linkingAnnotation.body)
      ? linkingAnnotation.body
      : linkingAnnotation.body
        ? [linkingAnnotation.body]
        : [];

    // Type-safe body extraction
    const identifyingBody = bodies.find(
      (body) => body.purpose === 'identifying',
    ) as BodyWithSource | undefined;
    const geotaggingBody = bodies.find(
      (body) => body.purpose === 'geotagging',
    ) as BodyWithSource | undefined;
    const selectingBody = bodies.find(
      (body) => body.purpose === 'selecting',
    ) as BodyWithSelector | undefined;

    let canonicalPlaceId: string;
    let canonicalName: string;
    let canonicalCategory: string;
    let geoCoordinates: { x: number; y: number } | undefined;
    let modernName: string | undefined;
    let alternativeNames: string[] | undefined;
    let pixelCoordinates: { x: number; y: number } | undefined;

    // Extract place data from geotagging body
    if (geotaggingBody && geotaggingBody.source) {
      const geoSource = geotaggingBody.source as GeotaggingSource;
      canonicalPlaceId = geoSource.uri ?? geoSource.id ?? linkingAnnotation.id;

      canonicalName =
        geoSource.preferredTerm ??
        geoSource.label ??
        geoSource.properties?.title ??
        'Unknown Place';

      const categoryValue =
        geoSource.category ?? geoSource.properties?.category ?? 'place';
      canonicalCategory = categoryValue.toString().split('/')[0] ?? 'place';

      if (geoSource.geometry?.coordinates) {
        geoCoordinates = {
          x: geoSource.geometry.coordinates[0],
          y: geoSource.geometry.coordinates[1],
        };
      } else if (
        geoSource.properties &&
        geoSource.properties.lat &&
        geoSource.properties.lon
      ) {
        geoCoordinates = {
          x: parseFloat(geoSource.properties.lon),
          y: parseFloat(geoSource.properties.lat),
        };
      }

      if (geoSource.properties?.display_name) {
        modernName = geoSource.properties.display_name;
      }

      alternativeNames =
        geoSource.alternativeTerms ?? geoSource.properties?.alternativeTerms;
    } else if (identifyingBody && identifyingBody.source) {
      const identifyingSource = identifyingBody.source as IdentifyingSource;
      canonicalPlaceId =
        identifyingSource.uri ?? identifyingSource.id ?? linkingAnnotation.id;
      canonicalName =
        identifyingSource.preferredTerm ??
        identifyingSource.label ??
        'Unknown Place';
      const catValue = identifyingSource.category ?? 'place';
      canonicalCategory = catValue.split('/')[0] ?? 'place';
      alternativeNames = identifyingSource.alternativeTerms;
    } else {
      canonicalPlaceId = linkingAnnotation.id;
      canonicalName = 'Unknown Place';
      canonicalCategory = 'place';
    }

    // Extract pixel coordinates from selecting body
    if (selectingBody && selectingBody.selector) {
      const selector = selectingBody.selector;
      // Type assertion already guarantees PointSelector
      pixelCoordinates = {
        x: selector.x,
        y: selector.y,
      };
    }

    // Fetch target annotations for text recognition (batch fetch for performance)
    const textRecognitionSources: Array<{
      text: string;
      source: string;
      targetId: string;
    }> = [];

    // Batch fetch targets in groups
    const targetIds = linkingAnnotation.target.filter(
      (t): t is string => typeof t === 'string',
    );
    const BATCH_SIZE = CONCURRENT_TARGET_FETCHES;

    for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
      const batch = targetIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((targetId) => fetchTargetAnnotation(targetId)),
      );

      results.forEach((targetAnnotation, idx) => {
        if (
          !targetAnnotation ||
          targetAnnotation.motivation !== 'textspotting'
        ) {
          return;
        }

        const targetId = batch[idx];
        if (!targetId) {
          return;
        }

        const targetBodies = Array.isArray(targetAnnotation.body)
          ? targetAnnotation.body
          : targetAnnotation.body
            ? [targetAnnotation.body]
            : [];

        targetBodies.forEach((body: AnnotationBody) => {
          if (body.value && typeof body.value === 'string') {
            interface BodyWithGenerator {
              creator?: unknown;
              generator?: {
                label?: string;
              };
            }
            const bodyWithGen = body as unknown as BodyWithGenerator;
            const source = bodyWithGen.creator
              ? 'human'
              : (bodyWithGen.generator?.label?.includes('Loghi') ?? false)
                ? 'loghi-htr'
                : 'ai-pipeline';

            textRecognitionSources.push({
              text: body.value.trim(),
              source,
              targetId,
            });
          }
        });
      });
    }

    // If no name from geotagging/identifying, try to construct from text
    if (
      canonicalName === 'Unknown Place' &&
      textRecognitionSources.length > 0
    ) {
      const bestTexts = textRecognitionSources
        .sort((a, b) => {
          const priorityA =
            a.source === 'human' ? 1 : a.source === 'loghi-htr' ? 2 : 3;
          const priorityB =
            b.source === 'human' ? 1 : b.source === 'loghi-htr' ? 2 : 3;
          return priorityA - priorityB;
        })
        .map((s) => s.text);

      canonicalName = bestTexts.slice(0, 3).join(' ').trim();
    }

    const place: ProcessedPlace = {
      id: canonicalPlaceId,
      name: canonicalName,
      category: canonicalCategory,
      coordinates: geoCoordinates || pixelCoordinates,
      coordinateType: geoCoordinates ? 'geographic' : 'pixel',
      modernName,
      alternativeNames,
      linkingAnnotationId: linkingAnnotation.id,
      textParts: textRecognitionSources.map((src) => ({
        value: src.text,
        source: src.source === 'human' ? 'creator' : 'loghi',
        targetId: src.targetId,
      })),
      isGeotagged: !!geotaggingBody,
      hasPointSelection: !!pixelCoordinates,
      hasGeotagging: !!geotaggingBody,
      hasHumanVerification: textRecognitionSources.some(
        (s) => s.source === 'human',
      ),
    };

    placeMap.set(canonicalPlaceId, place);
  }

  return Array.from(placeMap.values());
}

/**
 * Fetch a single page of linking annotations and process into places
 * This endpoint returns processed places directly for progressive loading
 */
// eslint-disable-next-line no-restricted-syntax -- Edge runtime requires Response not NextResponse
export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '0');

    const customQueryUrl =
      page === 0
        ? `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==`
        : `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==?page=${page}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(customQueryUrl, {
      headers: {
        Accept: '*/*',
        'Cache-Control': 'no-cache',
        'User-Agent': 'curl/8.7.1',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = (await response.json()) as {
      items?: LinkingAnnotation[];
      next?: string;
    };

    const annotations = result.items || [];

    // Process annotations into places
    const places = await processLinkingAnnotations(annotations);

    return jsonResponse({
      places,
      hasMore: !!result.next,
      page,
      count: places.length,
      rawAnnotationCount: annotations.length,
    });
  } catch (error) {
    console.error(`Failed to fetch gazetteer linking page:`, error);

    // Return empty result for graceful degradation
    return jsonResponse({
      places: [],
      hasMore: false,
      page: 0,
      count: 0,
      rawAnnotationCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
