import { parseContent } from '../../../../lib/gazetteer/parse-content';

// Use Netlify Edge Functions for longer timeout
export const runtime = 'edge';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const REQUEST_TIMEOUT = 5000; // 5 seconds per request
const CONCURRENT_TARGET_FETCHES = 20; // Maximum concurrency
const MAX_TARGET_ANNOTATIONS = 30; // Fetch up to 30 target annotations to get more iconography data

let globaliseDatasetCache: Map<string, GlobalisePlace> | null = null;
let neruDatasetCache: Map<string, NeruPlace> | null = null;

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
  part_of?: Array<{
    id: string;
    type: string;
    _label: string;
    classified_as?: Array<{
      id: string;
      type: string;
      _label: string;
    }>;
  }>;
  referred_to_by?: Array<{
    type: string;
    content?: string;
    classified_as?: Array<{
      id: string;
      type: string;
      _label: string;
    }>;
  }>;
}

interface NeruPlace {
  id: string;
  _label: string;
  identified_by?: Array<GlobaliseName | { type: string; content?: string }>;
  part_of?: Array<{
    id: string;
    type: string;
    _label: string;
    classified_as?: Array<{
      id: string;
      type: string;
      _label: string;
    }>;
  }>;
  referred_to_by?: Array<{
    type: string;
    content?: string;
    classified_as?: Array<{
      id: string;
      type: string;
      _label: string;
    }>;
  }>;
}

async function loadGlobaliseDataset(): Promise<Map<string, GlobalisePlace>> {
  if (globaliseDatasetCache) {
    return globaliseDatasetCache;
  }

  try {
    const datasetUrl =
      'https://necessaryreunions.org/globalise-place-dataset.json';
    const response = await fetch(datasetUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
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
  } catch {
    return new Map();
  }
}

async function loadNeruDataset(): Promise<Map<string, NeruPlace>> {
  if (neruDatasetCache) {
    return neruDatasetCache;
  }

  try {
    const datasetUrl = 'https://necessaryreunions.org/neru-place-dataset.json';
    const response = await fetch(datasetUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return new Map();
    }

    const dataset = (await response.json()) as NeruPlace[];
    const map = new Map<string, NeruPlace>();

    dataset.forEach((place) => {
      if (place.id) {
        map.set(place.id, place);
      }
    });

    neruDatasetCache = map;
    return map;
  } catch {
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
  geotagSource?: {
    id: string;
    label: string;
    thesaurus: 'gavoc' | 'openstreetmap' | 'globalise' | 'unknown';
  };
  textParts?: Array<{ value: string; source: string; targetId: string }>;
  textRecognitionSources?: Array<{
    text: string;
    source: string;
    targetId: string;
    svgSelector?: string;
    canvasUrl?: string;
    motivation?: 'textspotting' | 'iconography';
    classification?: {
      label: string;
      id: string;
      creator?: {
        id: string;
        type: string;
        label: string;
      };
      created?: string;
    };
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
  mapReferences?: Array<{
    mapId: string;
    mapTitle: string;
    canvasId: string;
    gridSquare?: string;
    pageNumber?: string;
    linkingAnnotationId?: string;
  }>;
  linkingAnnotationCount?: number;
  partOf?: Array<{
    id: string;
    label: string;
    type?: string;
    classified_as?: Array<{
      id: string;
      type: string;
      _label: string;
    }>;
  }>;
  parsedRemarks?: {
    context: string[];
    coord: string[];
    disambiguation: string[];
    association: string[];
    inference: string[];
    automatic: string[];
    source: string[];
    altLabel: string[];
    other: string[];
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
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;
    return data;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

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

async function processLinkingAnnotations(
  annotations: LinkingAnnotation[],
  skipTargetFetch: boolean = false,
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
    let geotagSource:
      | {
          id: string;
          label: string;
          thesaurus: 'gavoc' | 'openstreetmap' | 'globalise' | 'unknown';
        }
      | undefined;

    const determineThesaurus = (
      id: string,
    ): 'gavoc' | 'openstreetmap' | 'globalise' | 'unknown' => {
      if (id.includes('necessaryreunions.org/gavoc/')) {
        return 'gavoc';
      }
      if (id.includes('nominatim.openstreetmap.org')) {
        return 'openstreetmap';
      }
      if (id.includes('id.necessaryreunions.org/place/')) {
        return 'globalise';
      }
      return 'unknown';
    };

    if (geotaggingBody && geotaggingBody.source) {
      const geoSource = geotaggingBody.source as GeotaggingSource;
      canonicalPlaceId = geoSource.uri ?? geoSource.id ?? linkingAnnotation.id;

      // DEBUG: Log geotagging source structure for Porakad
      if (
        geoSource.preferredTerm?.toLowerCase().includes('porakad') ||
        geoSource.label?.toLowerCase().includes('porakad') ||
        geoSource.properties?.title?.toLowerCase().includes('porakad')
      ) {
        console.log('[PORAKAD DEBUG] Geotagging body source:', {
          preferredTerm: geoSource.preferredTerm,
          label: geoSource.label,
          propertiesTitle: geoSource.properties?.title,
          hasProperties: !!geoSource.properties,
          rawSource: JSON.stringify(geoSource).slice(0, 500),
        });
      }

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

      const sourceId = geoSource.uri ?? geoSource.id ?? '';
      if (sourceId) {
        geotagSource = {
          id: sourceId,
          label:
            geoSource.preferredTerm ??
            geoSource.label ??
            geoSource.properties?.title ??
            'Unknown Place',
          thesaurus: determineThesaurus(sourceId),
        };
      }
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

      const sourceId = identifyingSource.uri ?? identifyingSource.id ?? '';
      if (sourceId) {
        geotagSource = {
          id: sourceId,
          label:
            identifyingSource.preferredTerm ??
            identifyingSource.label ??
            'Unknown Place',
          thesaurus: determineThesaurus(sourceId),
        };
      }
    } else {
      canonicalPlaceId = linkingAnnotation.id;
      canonicalName = 'Unknown Place';
      canonicalCategory = 'place';
    }

    // Extract additional data from GLOBALISE or NeRu datasets
    let partOf:
      | Array<{
          id: string;
          label: string;
          type?: string;
          classified_as?: Array<{
            id: string;
            type: string;
            _label: string;
          }>;
        }>
      | undefined;
    let parsedRemarks:
      | {
          context: string[];
          coord: string[];
          disambiguation: string[];
          association: string[];
          inference: string[];
          automatic: string[];
          source: string[];
          altLabel: string[];
          other: string[];
        }
      | undefined;

    if (canonicalPlaceId.includes('id.necessaryreunions.org/place/')) {
      // Try both datasets - could be GLOBALISE or NeRu
      const [globaliseDataset, neruDataset] = await Promise.all([
        loadGlobaliseDataset(),
        loadNeruDataset(),
      ]);

      const globalisePlace = globaliseDataset.get(canonicalPlaceId);
      const neruPlace = neruDataset.get(canonicalPlaceId);

      const place = globalisePlace || neruPlace;

      if (place) {
        // Extract alternative names
        const placeAlternatives = extractGlobaliseAlternativeNames(place);
        if (placeAlternatives.length > 0) {
          const allAlternatives = new Set([
            ...(alternativeNames || []),
            ...placeAlternatives,
          ]);
          alternativeNames = Array.from(allAlternatives);
        }

        // Extract part_of hierarchy
        if (place.part_of && place.part_of.length > 0) {
          partOf = place.part_of.map((parent) => ({
            id: parent.id,
            label: parent._label,
            type: parent.type,
            classified_as: parent.classified_as,
          }));
        }

        // Extract and parse remarks from referred_to_by
        if (place.referred_to_by && place.referred_to_by.length > 0) {
          const allRemarks: typeof parsedRemarks = {
            context: [],
            coord: [],
            disambiguation: [],
            association: [],
            inference: [],
            automatic: [],
            source: [],
            altLabel: [],
            other: [],
          };

          place.referred_to_by.forEach((reference) => {
            if (reference.content) {
              const parsed = parseContent(reference.content);
              // Merge all sections
              allRemarks.context.push(...parsed.context);
              allRemarks.coord.push(...parsed.coord);
              allRemarks.disambiguation.push(...parsed.disambiguation);
              allRemarks.association.push(...parsed.association);
              allRemarks.inference.push(...parsed.inference);
              allRemarks.automatic.push(...parsed.automatic);
              allRemarks.source.push(...parsed.source);
              allRemarks.altLabel.push(...parsed.altLabel);
              allRemarks.other.push(...parsed.other);
            }
          });

          // Only set if there's actual content
          const hasContent = Object.values(allRemarks).some(
            (arr) => arr.length > 0,
          );
          if (hasContent) {
            parsedRemarks = allRemarks;
          }
        }
      }
    }

    if (selectingBody && selectingBody.selector) {
      const selector = selectingBody.selector;
      // Type assertion already guarantees PointSelector
      pixelCoordinates = {
        x: selector.x,
        y: selector.y,
      };
    }

    let canvasId: string | undefined;
    if (selectingBody && selectingBody.source) {
      const source = selectingBody.source;
      if (typeof source === 'string') {
        canvasId = source;
      }
    }

    const textRecognitionSources: Array<{
      text: string;
      source: string;
      targetId: string;
      svgSelector?: string;
      canvasUrl?: string;
      motivation?: 'textspotting' | 'iconography';
      classification?: {
        label: string;
        id: string;
        creator?: {
          id: string;
          type: string;
          label: string;
        };
        created?: string;
      };
    }> = [];
    const commentSources: Array<{ text: string; targetId: string }> = [];
    const assessmentChecks: boolean[] = [];

    const targetIds = linkingAnnotation.target.filter(
      (t): t is string => typeof t === 'string',
    );

    // Skip target fetching if requested (for performance when querying by slug)
    if (skipTargetFetch) {
      // Don't fetch any target annotations - just return basic place info
      // Iconography will be fetched separately via /iconography endpoint
    } else {
      // Limit target annotations to prevent timeout
      const limitedTargetIds = targetIds.slice(0, MAX_TARGET_ANNOTATIONS);
      if (canonicalName.toLowerCase().includes('porakad')) {
        console.log(
          `[PORAKAD DEBUG] Total targets: ${targetIds.length}, Limited to: ${limitedTargetIds.length}`,
        );
      }
      const BATCH_SIZE = CONCURRENT_TARGET_FETCHES;

      // Extract current canonicalName to avoid closure issues in loop
      const currentCanonicalName = canonicalName;

      for (let i = 0; i < limitedTargetIds.length; i += BATCH_SIZE) {
        const batch = limitedTargetIds.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((targetId) => fetchTargetAnnotation(targetId)),
        );

        results.forEach((result, idx) => {
          const targetId = batch[idx];
          if (!targetId) {
            return;
          }

          const targetAnnotation =
            result.status === 'fulfilled' ? result.value : null;
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

          if (isIconography && svgSelector && targetCanvasUrl) {
            let classification:
              | {
                  label: string;
                  id: string;
                  creator?: {
                    id: string;
                    type: string;
                    label: string;
                  };
                  created?: string;
                }
              | undefined;

            const targetBodies = Array.isArray(targetAnnotation.body)
              ? targetAnnotation.body
              : targetAnnotation.body
                ? [targetAnnotation.body]
                : [];

            targetBodies.forEach((body: AnnotationBody) => {
              if (body.purpose === 'classifying' && body.source) {
                interface ClassifyingSource {
                  id?: string;
                  label?: string;
                  [key: string]: unknown;
                }
                const source = body.source as ClassifyingSource;

                if (source.label) {
                  interface BodyWithCreator {
                    creator?: {
                      id?: string;
                      type?: string;
                      label?: string;
                    };
                    created?: string;
                  }
                  const bodyWithCreator = body as unknown as BodyWithCreator;

                  classification = {
                    label: source.label,
                    id: source.id || '',
                    creator: bodyWithCreator.creator
                      ? {
                          id: bodyWithCreator.creator.id || '',
                          type: bodyWithCreator.creator.type || 'Person',
                          label: bodyWithCreator.creator.label || '',
                        }
                      : undefined,
                    created: bodyWithCreator.created,
                  };
                }
              }
            });

            textRecognitionSources.push({
              text: classification?.label || 'Icon',
              source: 'icon',
              targetId,
              svgSelector,
              canvasUrl: targetCanvasUrl,
              motivation: 'iconography',
              classification,
            });
            if (currentCanonicalName.toLowerCase().includes('porakad')) {
              console.log(
                `[PORAKAD DEBUG] Added iconography: ${classification?.label || 'Icon'} from ${targetId}`,
              );
            }
            return;
          }

          // Handle textspotting annotations
          if (isTextspotting) {
            const targetBodies = Array.isArray(targetAnnotation.body)
              ? targetAnnotation.body
              : targetAnnotation.body
                ? [targetAnnotation.body]
                : [];

            // Collect all text candidates for this annotation (prioritize human over AI)
            const textCandidates: Array<{
              text: string;
              source: string;
              priority: number;
            }> = [];

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

              // Priority: 1 = human (highest), 2 = loghi-htr, 3 = ai-pipeline
              const priority =
                source === 'human' ? 1 : source === 'loghi-htr' ? 2 : 3;

              textCandidates.push({
                text: body.value.trim(),
                source,
                priority,
              });
            });

            // Pick the best text (lowest priority number = highest preference)
            if (textCandidates.length > 0) {
              const bestText = textCandidates.sort(
                (a, b) => a.priority - b.priority,
              )[0];
              if (bestText) {
                textRecognitionSources.push({
                  text: bestText.text,
                  source: bestText.source,
                  targetId,
                  svgSelector,
                  canvasUrl: targetCanvasUrl,
                  motivation: 'textspotting',
                });
              }
            }
          }
        });
      }
    } // Close the else block for skipTargetFetch

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
      // Exclude iconography annotations from name construction
      const textByTarget = new Map<
        string,
        { text: string; source: string; priority: number }
      >();

      textRecognitionSources.forEach((src) => {
        // Skip icons when building place name
        if (src.motivation === 'iconography' || src.source === 'icon') {
          return;
        }

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

      if (orderedTexts.length > 0) {
        canonicalName = orderedTexts.join(' ').trim();
      }
    }

    // If still no name but has iconography classifications, use those as the name
    if (
      canonicalName === 'Unknown Place' &&
      textRecognitionSources.length > 0
    ) {
      const iconographyClassifications = textRecognitionSources
        .filter(
          (src) =>
            src.motivation === 'iconography' && src.classification?.label,
        )
        .map((src) => src.classification!.label);

      if (iconographyClassifications.length > 0) {
        // Use first unique classification as name
        const uniqueClassifications = [...new Set(iconographyClassifications)];
        canonicalName = uniqueClassifications[0] || 'Unknown Place';
      }
    }

    // Skip places that still have no proper name
    // This happens when there's no geotagging/identifying body and no text annotations
    if (canonicalName === 'Unknown Place') {
      continue;
    }

    // DEBUG: Log final canonicalName before place creation
    if (canonicalName.toLowerCase().includes('porakad')) {
      console.log('[PORAKAD DEBUG] Final canonicalName after all processing:', {
        canonicalName,
        canonicalPlaceId,
        hasGeotagging: !!geotaggingBody,
        hasIdentifying: !!identifyingBody,
        hasText: textRecognitionSources.length,
      });
    }

    // Create a normalized key for detecting duplicates across different sources
    // Format: "name|lat|lng" (normalized to 2 decimal places for slight coordinate variations)
    const createDuplicateKey = (
      name: string,
      coords?: { x: number; y: number },
    ): string | null => {
      if (!coords) return null;
      const normalizedName = name.toLowerCase().trim();
      // Round to 2 decimal places (~1km precision) to catch slight variations
      const lat = Math.round(coords.y * 100) / 100;
      const lng = Math.round(coords.x * 100) / 100;
      return `${normalizedName}|${lat}|${lng}`;
    };

    const duplicateKey = createDuplicateKey(canonicalName, geoCoordinates);

    // Check if we already have an entry for this geotag (by ID)
    let existingPlace = placeMap.get(canonicalPlaceId);

    if (!existingPlace && duplicateKey && geoCoordinates) {
      for (const place of placeMap.values()) {
        const placeKey = createDuplicateKey(place.name, place.coordinates);
        if (
          placeKey === duplicateKey &&
          place.coordinateType === 'geographic'
        ) {
          existingPlace = place;
          break;
        }
      }
    }

    if (existingPlace) {
      // Merge data from this linking annotation into existing place

      // If merging from a different source, prefer GAVOC > GLOBALISE > OpenStreetMap
      if (canonicalPlaceId !== existingPlace.id && geotagSource) {
        const existingThesaurus = existingPlace.geotagSource?.thesaurus;
        const newThesaurus = geotagSource.thesaurus;

        // Priority: gavoc > globalise > openstreetmap
        const thesaurusPriority = {
          gavoc: 3,
          globalise: 2,
          openstreetmap: 1,
          unknown: 0,
        };

        const existingPriority =
          thesaurusPriority[existingThesaurus ?? 'unknown'];
        const newPriority = thesaurusPriority[newThesaurus];

        // Update to higher priority source
        if (newPriority > existingPriority) {
          existingPlace.id = canonicalPlaceId;
          existingPlace.geotagSource = geotagSource;
          existingPlace.name = canonicalName;
          if (alternativeNames && existingPlace.alternativeNames) {
            // Add the old name as an alternative
            if (!existingPlace.alternativeNames.includes(existingPlace.name)) {
              existingPlace.alternativeNames.push(existingPlace.name);
            }
            // Merge new alternative names
            alternativeNames.forEach((alt) => {
              if (
                !existingPlace.alternativeNames?.includes(alt) &&
                alt !== existingPlace.name
              ) {
                existingPlace.alternativeNames!.push(alt);
              }
            });
          }
        } else if (alternativeNames) {
          // Lower priority source - add its names as alternatives
          if (!existingPlace.alternativeNames) {
            existingPlace.alternativeNames = [];
          }
          if (
            canonicalName !== existingPlace.name &&
            !existingPlace.alternativeNames.includes(canonicalName)
          ) {
            existingPlace.alternativeNames.push(canonicalName);
          }
          alternativeNames.forEach((alt) => {
            if (
              !existingPlace.alternativeNames?.includes(alt) &&
              alt !== existingPlace.name
            ) {
              existingPlace.alternativeNames!.push(alt);
            }
          });
        }
      }

      // Increment linking annotation count
      existingPlace.linkingAnnotationCount =
        (existingPlace.linkingAnnotationCount ?? 1) + 1;

      // Add map reference for this linking annotation occurrence
      // Each linking annotation gets its own entry, even if same canvas
      if (canvasId) {
        if (!existingPlace.mapReferences) {
          existingPlace.mapReferences = [];
        }
        existingPlace.mapReferences.push({
          mapId: canvasId,
          mapTitle: '',
          canvasId,
          linkingAnnotationId: linkingAnnotation.id,
        });
      }

      // Merge text parts (avoid duplicates)
      const newTextParts = textRecognitionSources
        .filter(
          (src) => src.motivation !== 'iconography' && src.source !== 'icon',
        )
        .map((src) => ({
          value: src.text,
          source:
            src.source === 'human'
              ? 'creator'
              : src.source === 'icon'
                ? 'icon'
                : 'loghi',
          targetId: src.targetId,
        }));

      if (!existingPlace.textParts) {
        existingPlace.textParts = [];
      }
      existingPlace.textParts.push(...newTextParts);

      // Merge text recognition sources (these include SVG snippets)
      const newRecognitionSources = textRecognitionSources.map((src) => ({
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
      }));

      if (!existingPlace.textRecognitionSources) {
        existingPlace.textRecognitionSources = [];
      }
      existingPlace.textRecognitionSources.push(...newRecognitionSources);

      // Merge comments
      if (commentSources.length > 0) {
        if (!existingPlace.comments) {
          existingPlace.comments = [];
        }
        existingPlace.comments.push(
          ...commentSources.map((c) => ({
            value: c.text,
            targetId: c.targetId,
          })),
        );
      }

      // Update flags (OR logic - if any occurrence has it, the place has it)
      existingPlace.hasPointSelection =
        existingPlace.hasPointSelection || !!pixelCoordinates;
      existingPlace.hasHumanVerification =
        existingPlace.hasHumanVerification ||
        textRecognitionSources.some((s) => s.source === 'human') ||
        hasAssessmentCheck;

      // Update partOf and parsedRemarks if available (don't override existing)
      if (partOf && !existingPlace.partOf) {
        existingPlace.partOf = partOf;
      }
      if (parsedRemarks && !existingPlace.parsedRemarks) {
        existingPlace.parsedRemarks = parsedRemarks;
      }
    } else {
      // First occurrence of this geotag - create new place entry
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
        geotagSource,
        textParts: textRecognitionSources
          .filter(
            (src) => src.motivation !== 'iconography' && src.source !== 'icon',
          )
          .map((src) => ({
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
          classification: src.classification, // Include classification data for iconography
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
        mapReferences: canvasId
          ? [
              {
                mapId: canvasId,
                mapTitle: '',
                canvasId,
                linkingAnnotationId: linkingAnnotation.id,
              },
            ]
          : [],
        linkingAnnotationCount: 1,
        partOf,
        parsedRemarks,
      };

      // DEBUG: Log when Porakad place is added to map
      if (place.name.toLowerCase().includes('porakad')) {
        console.log('[PORAKAD DEBUG] Adding place to placeMap:', {
          id: place.id,
          name: place.name,
          alternativeNames: place.alternativeNames,
          hasTextRecognition: place.textRecognitionSources?.length || 0,
          linkingAnnotationId: place.linkingAnnotationId,
        });
      }

      placeMap.set(canonicalPlaceId, place);
    }
  }

  // DEBUG: Log final placeMap contents for Porakad
  const porakadPlaces = Array.from(placeMap.values()).filter((p) =>
    p.name.toLowerCase().includes('porakad'),
  );
  if (porakadPlaces.length > 0) {
    console.log('[PORAKAD DEBUG] Porakad places in final placeMap:', {
      count: porakadPlaces.length,
      names: porakadPlaces.map((p) => p.name),
      ids: porakadPlaces.map((p) => p.id),
    });
  } else {
    console.log('[PORAKAD DEBUG] NO Porakad places in final placeMap');
    console.log(
      '[PORAKAD DEBUG] Total places in map:',
      placeMap.size,
      'Sample names:',
      Array.from(placeMap.values())
        .slice(0, 10)
        .map((p) => p.name),
    );
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
    const slug = searchParams.get('slug');
    const limit = parseInt(searchParams.get('limit') || '100');

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
    // Always process fully - don't skip target fetching
    let places = await processLinkingAnnotations(annotations, false);

    if (slug) {
      console.log(`[SLUG DEBUG] Looking for slug: "${slug}"`);
      if (slug === 'porakad') {
        console.log(
          `[SLUG DEBUG] Total places from processLinkingAnnotations: ${places.length}`,
        );
        console.log(
          '[SLUG DEBUG] All place names:',
          places.map((p) => p.name),
        );
      }

      // Find places with names similar to the slug
      const similarPlaces = places.filter((p) => {
        const pSlug = p.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        return (
          pSlug.includes(slug.slice(0, 4)) || slug.includes(pSlug.slice(0, 4))
        );
      });

      if (similarPlaces.length > 0) {
        console.log(
          `[SLUG DEBUG] Similar places found:`,
          similarPlaces.map((p) => ({
            name: p.name,
            slug: p.name
              .toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/g, ''),
            alternativeNames: p.alternativeNames,
            id: p.id,
          })),
        );
      }

      const matchedPlace = places.find((p) => {
        const placeSlug = p.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');

        return placeSlug === slug;
      });

      if (matchedPlace) {
        if (matchedPlace.name.toLowerCase().includes('porakad')) {
          console.log(
            `[PORAKAD DEBUG] Final place has ${matchedPlace.textRecognitionSources?.length || 0} textRecognitionSources`,
          );
          console.log(
            '[PORAKAD DEBUG] Iconography sources:',
            matchedPlace.textRecognitionSources
              ?.filter((s) => s.motivation === 'iconography')
              .map((s) => ({ text: s.text, targetId: s.targetId })),
          );
        }
        return jsonResponse({
          places: [matchedPlace],
          hasMore: false,
          page,
          count: 1,
          rawAnnotationCount: annotations.length,
        });
      }

      if (page === 0 && result.next) {
        const parallelPages = [1, 2, 3, 4, 5, 6, 7];
        const searchPromises = parallelPages.map(async (pageNum) => {
          try {
            const pageUrl = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==?page=${pageNum}`;

            const pageController = new AbortController();
            const pageTimeoutId = setTimeout(
              () => pageController.abort(),
              3000,
            ); // 3s timeout for parallel requests

            const pageResponse = await fetch(pageUrl, {
              headers: {
                Accept: '*/*',
                'Cache-Control': 'no-cache',
                'User-Agent': 'curl/8.7.1',
              },
              signal: pageController.signal,
            });

            clearTimeout(pageTimeoutId);

            if (!pageResponse.ok) return null;

            const pageResult = (await pageResponse.json()) as {
              items?: LinkingAnnotation[];
            };

            const pageAnnotations = pageResult.items || [];
            const pagePlaces = await processLinkingAnnotations(
              pageAnnotations,
              false,
            );

            const match = pagePlaces.find((p) => {
              const placeSlug = p.name
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');

              return placeSlug === slug;
            });

            return match;
          } catch {
            return null;
          }
        });

        const results = await Promise.all(searchPromises);
        const found = results.find((p) => p !== null);

        if (found) {
          return jsonResponse({
            places: [found],
            hasMore: false,
            page: 0,
            count: 1,
            rawAnnotationCount: annotations.length,
          });
        }

        const secondBatchPages = [8, 9, 10, 11, 12, 13, 14, 15];
        const secondBatchPromises = secondBatchPages.map(async (pageNum) => {
          try {
            const pageUrl = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==?page=${pageNum}`;

            const pageController = new AbortController();
            const pageTimeoutId = setTimeout(
              () => pageController.abort(),
              3000,
            );

            const pageResponse = await fetch(pageUrl, {
              headers: {
                Accept: '*/*',
                'Cache-Control': 'no-cache',
                'User-Agent': 'curl/8.7.1',
              },
              signal: pageController.signal,
            });

            clearTimeout(pageTimeoutId);

            if (!pageResponse.ok) return null;

            const pageResult = (await pageResponse.json()) as {
              items?: LinkingAnnotation[];
            };

            const pageAnnotations = pageResult.items || [];
            const pagePlaces = await processLinkingAnnotations(
              pageAnnotations,
              false,
            );

            return pagePlaces.find((p) => {
              const placeSlug = p.name
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');
              return placeSlug === slug;
            });
          } catch {
            return null;
          }
        });

        const secondResults = await Promise.all(secondBatchPromises);
        const secondFound = secondResults.find((p) => p !== null);

        if (secondFound) {
          return jsonResponse({
            places: [secondFound],
            hasMore: false,
            page: 0,
            count: 1,
            rawAnnotationCount: annotations.length,
          });
        }
      }

      // Not found
      return jsonResponse({
        places: [],
        hasMore: false,
        page,
        count: 0,
        rawAnnotationCount: annotations.length,
      });
    }

    // Normal pagination - apply limit
    places = places.slice(0, limit);

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
