// Use Netlify Edge Functions for longer timeout
export const runtime = 'edge';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const REQUEST_TIMEOUT = 3500; // 3.5 seconds - conservative for Netlify
const CONCURRENT_TARGET_FETCHES = 10; // Fetch targets in parallel

// GLOBALISE Place Dataset - loaded once at module level
let globaliseDatasetCache: Map<string, GlobalisePlace> | null = null;

interface GlobaliseName {
  type: 'Name';
  content: string;
  classified_as?: Array<{
    id: string;
    type: string;
    _label: string;
  }>;
}

interface GlobalisePlace {
  id: string;
  _label: string;
  identified_by?: Array<GlobaliseName | { type: string; content?: string }>;
}

async function loadGlobaliseDataset(): Promise<Map<string, GlobalisePlace>> {
  if (globaliseDatasetCache) {
    return globaliseDatasetCache;
  }

  try {
    // Load from public directory
    const datasetUrl =
      'https://necessaryreunions.org/globalise-place-dataset.json';
    const response = await fetch(datasetUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.error('Failed to load GLOBALISE dataset:', response.status);
      return new Map();
    }

    const dataset = (await response.json()) as GlobalisePlace[];
    const map = new Map<string, GlobalisePlace>();

    dataset.forEach((place) => {
      if (place.id) {
        map.set(place.id, place);
      }
    });

    globaliseDatasetCache = map;
    return map;
  } catch (error) {
    console.error('Error loading GLOBALISE dataset:', error);
    return new Map();
  }
}

function extractGlobaliseAlternativeNames(place: GlobalisePlace): string[] {
  if (!place.identified_by) {
    return [];
  }

  const alternativeNames: string[] = [];

  place.identified_by.forEach((identifier) => {
    if (
      identifier.type === 'Name' &&
      'content' in identifier &&
      identifier.content
    ) {
      const nameEntry = identifier as GlobaliseName;
      const isAlternative = nameEntry.classified_as?.some(
        (classification) => classification.id === 'ALT',
      );

      if (isAlternative) {
        alternativeNames.push(nameEntry.content);
      }
    }
  });

  return alternativeNames;
}

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
  textRecognitionSources?: Array<{
    text: string;
    source: string;
    targetId: string;
    svgSelector?: string;
    canvasUrl?: string;
    motivation?: 'textspotting' | 'iconography';
  }>;
  comments?: Array<{ value: string; targetId: string }>;
  isGeotagged?: boolean;
  hasPointSelection?: boolean;
  hasGeotagging?: boolean;
  hasHumanVerification?: boolean;
  canvasId?: string;
  mapInfo?: {
    id: string;
    title: string;
    date?: string;
    permalink?: string;
    canvasId: string;
  };
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

  // Load GLOBALISE dataset for alternative name enrichment
  const globaliseDataset = await loadGlobaliseDataset();

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

    // Enrich alternative names from GLOBALISE dataset
    if (canonicalPlaceId.includes('id.necessaryreunions.org/place/')) {
      const globalisePlace = globaliseDataset.get(canonicalPlaceId);
      if (globalisePlace) {
        const globaliseAlternatives =
          extractGlobaliseAlternativeNames(globalisePlace);
        if (globaliseAlternatives.length > 0) {
          // Merge with existing alternatives, avoiding duplicates
          const allAlternatives = new Set([
            ...(alternativeNames || []),
            ...globaliseAlternatives,
          ]);
          alternativeNames = Array.from(allAlternatives);
        }
      }
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

    // Extract canvas ID from selecting body or first target annotation
    let canvasId: string | undefined;
    if (selectingBody && selectingBody.source) {
      const source = selectingBody.source;
      if (typeof source === 'string') {
        canvasId = source;
      }
    }

    // Fetch target annotations for text recognition (batch fetch for performance)
    const textRecognitionSources: Array<{
      text: string;
      source: string;
      targetId: string;
      svgSelector?: string;
      canvasUrl?: string;
      motivation?: 'textspotting' | 'iconography';
    }> = [];
    const commentSources: Array<{ text: string; targetId: string }> = [];
    const assessmentChecks: boolean[] = []; // Track assessments in array

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
        const targetId = batch[idx];
        if (!targetId) {
          return;
        }

        if (!targetAnnotation) {
          return;
        }

        const isTextspotting = targetAnnotation.motivation === 'textspotting';
        const isIconography =
          targetAnnotation.motivation === 'iconography' ||
          targetAnnotation.motivation === 'iconograpy';

        if (!isTextspotting && !isIconography) {
          return;
        }

        // Extract SVG selector and canvas URL from target
        let svgSelector: string | undefined;
        let targetCanvasUrl: string | undefined;

        interface TargetWithSource {
          source?: string;
          selector?: {
            type: string;
            value?: string;
          };
        }

        if (targetAnnotation.target) {
          const target = targetAnnotation.target as TargetWithSource;
          if (target.source && typeof target.source === 'string') {
            targetCanvasUrl = target.source;
          }
          if (
            target.selector &&
            target.selector.type === 'SvgSelector' &&
            target.selector.value
          ) {
            svgSelector = target.selector.value;
          }
        }

        // Handle iconography annotations (SVG only, no text)
        if (isIconography && svgSelector && targetCanvasUrl) {
          textRecognitionSources.push({
            text: 'Icon',
            source: 'icon',
            targetId,
            svgSelector,
            canvasUrl: targetCanvasUrl,
            motivation: 'iconography',
          });
          return;
        }

        // Handle textspotting annotations
        if (isTextspotting) {
          const targetBodies = Array.isArray(targetAnnotation.body)
            ? targetAnnotation.body
            : targetAnnotation.body
              ? [targetAnnotation.body]
              : [];

          targetBodies.forEach((body: AnnotationBody) => {
            if (!body.value || typeof body.value !== 'string') {
              return;
            }

            // Handle comments separately
            if (body.purpose === 'commenting') {
              commentSources.push({
                text: body.value.trim(),
                targetId,
              });
              return;
            }

            // Track assessment checks for hasHumanVerification
            if (body.purpose === 'assessing') {
              assessmentChecks.push(true);
              return;
            }

            // Only include supplementing text for place names
            if (body.purpose !== 'supplementing') {
              return;
            }

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
              svgSelector,
              canvasUrl: targetCanvasUrl,
              motivation: 'textspotting',
            });
          });
        }
      });
    }

    const hasAssessmentCheck = assessmentChecks.length > 0;

    // If we don't have a canvas ID yet, fetch it from the first target annotation
    if (!canvasId && targetIds.length > 0) {
      const firstTargetId = targetIds[0];
      if (firstTargetId) {
        const firstTarget = await fetchTargetAnnotation(firstTargetId);
        if (firstTarget && firstTarget.target) {
          interface TargetWithSource {
            source?: string;
          }
          const target = firstTarget.target as TargetWithSource;
          if (target.source && typeof target.source === 'string') {
            canvasId = target.source;
          }
        }
      }
    }

    // If no name from geotagging/identifying, construct from creator-verified text parts
    if (
      canonicalName === 'Unknown Place' &&
      textRecognitionSources.length > 0
    ) {
      // Group by targetId to get one text per annotation (highest priority source)
      const textByTarget = new Map<
        string,
        { text: string; source: string; priority: number }
      >();

      textRecognitionSources.forEach((src) => {
        const priority =
          src.source === 'human' ? 1 : src.source === 'loghi-htr' ? 2 : 3;
        const existing = textByTarget.get(src.targetId);

        if (!existing || priority < existing.priority) {
          textByTarget.set(src.targetId, {
            text: src.text,
            source: src.source,
            priority,
          });
        }
      });

      // Build name from text parts in order (prefer human > loghi > ai)
      const orderedTexts = Array.from(textByTarget.values())
        .sort((a, b) => a.priority - b.priority)
        .map((t) => t.text);

      canonicalName = orderedTexts.join(' ').trim();
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
      canvasId,
      textParts: textRecognitionSources.map((src) => ({
        value: src.text,
        source:
          src.source === 'human'
            ? 'creator'
            : src.source === 'icon'
              ? 'icon'
              : 'loghi',
        targetId: src.targetId,
      })),
      textRecognitionSources: textRecognitionSources.map((src) => ({
        text: src.text,
        source:
          src.source === 'human'
            ? 'creator'
            : src.source === 'icon'
              ? 'icon'
              : 'loghi',
        targetId: src.targetId,
        svgSelector: src.svgSelector,
        canvasUrl: src.canvasUrl,
        motivation: src.motivation,
      })),
      comments:
        commentSources.length > 0
          ? commentSources.map((c) => ({
              value: c.text,
              targetId: c.targetId,
            }))
          : undefined,
      isGeotagged: !!geotaggingBody,
      hasPointSelection: !!pixelCoordinates,
      hasGeotagging: !!geotaggingBody,
      hasHumanVerification:
        textRecognitionSources.some((s) => s.source === 'human') ||
        hasAssessmentCheck,
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
