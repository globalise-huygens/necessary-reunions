import type {
  GazetteerFilter,
  GazetteerPlace,
  GazetteerSearchResult,
  PlaceCategory,
} from './types';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache
const MAX_PAGES_PER_REQUEST = 5; // Reasonable limit for incremental loading
const REQUEST_TIMEOUT = 10000; // 10 second timeout per request
const MAX_LINKING_ANNOTATIONS = 250; // Increased for better coverage
const MAX_TARGET_FETCHES = 100; // Reasonable balance

// Progressive loading approach
const PROGRESSIVE_BATCH_SIZE = 50; // Process annotations in batches

async function fetchAllAnnotations(): Promise<{
  linking: any[];
  geotagging: any[];
}> {
  const [linkingAnnotations, geotaggingAnnotations] = await Promise.all([
    fetchLinkingAnnotationsFromCustomQuery(),
    fetchGeotaggingAnnotationsFromCustomQuery(),
  ]);

  return { linking: linkingAnnotations, geotagging: geotaggingAnnotations };
}

async function fetchGeotaggingAnnotationsFromCustomQuery(): Promise<any[]> {
  const allAnnotations: any[] = [];
  let page = 0;
  let hasMore = true;
  const maxRetries = 2; // Reduce retries
  let pagesProcessed = 0;

  while (hasMore && pagesProcessed < MAX_PAGES_PER_REQUEST) {
    let retries = 0;
    let success = false;

    while (retries < maxRetries && !success) {
      try {
        const result = await throttleRequest(async () => {
          const customQueryUrl =
            page === 0
              ? `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=Z2VvdGFnZ2luZw==`
              : `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=Z2VvdGFnZ2luZw==?page=${page}`;

          const response = await fetch(customQueryUrl, {
            headers: {
              Accept: 'application/json',
              'Cache-Control': 'no-cache',
            },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return response.json();
        });

        if (result.items && Array.isArray(result.items)) {
          allAnnotations.push(...result.items);
        }

        hasMore = !!result.next;
        success = true;
        page++;
        pagesProcessed++;
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          console.warn(
            `Failed to fetch geotagging page ${page} after ${maxRetries} retries`,
          );
          hasMore = false;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 500 * retries));
        }
      }
    }
  }

  console.log(
    `Fetched ${allAnnotations.length} geotagging annotations in ${pagesProcessed} pages`,
  );
  return allAnnotations;
}

const MAX_CONCURRENT_REQUESTS = 5; // Reduce concurrent requests

let cachedPlaces: GazetteerPlace[] | null = null;
let cachedCategories: PlaceCategory[] | null = null;
let cachedGavocData: any[] | null = null;
let cacheTimestamp: number = 0;

const failedTargetIds = new Set<string>();
let blacklistCacheTime = 0;
const BLACKLIST_CACHE_DURATION = 60 * 60 * 1000;

let activeRequests = 0;
const requestQueue: (() => Promise<void>)[] = [];

async function throttleRequest<T>(requestFn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const executeRequest = async () => {
      if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
        requestQueue.push(executeRequest);
        return;
      }

      activeRequests++;
      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        activeRequests--;
        if (requestQueue.length > 0) {
          const nextRequest = requestQueue.shift();
          if (nextRequest) {
            setTimeout(nextRequest, 100);
          }
        }
      }
    };

    executeRequest();
  });
}

function debugAnnotations(annotations: any[], sampleSize: number = 5): void {
  const motivations = new Map<string, number>();

  annotations.forEach((ann) => {
    const motivation = ann.motivation || 'undefined';
    motivations.set(motivation, (motivations.get(motivation) || 0) + 1);
  });

  const linkingAnnotations = annotations.filter(
    (ann) => ann.motivation === 'linking',
  );

  const linkingWithTargets = linkingAnnotations.filter(
    (ann) => ann.target && Array.isArray(ann.target) && ann.target.length > 0,
  );
  const linkingWithBody = linkingAnnotations.filter(
    (ann) => ann.body && Array.isArray(ann.body),
  );
  const linkingWithGeotagging = linkingAnnotations.filter(
    (ann) =>
      ann.body &&
      Array.isArray(ann.body) &&
      ann.body.some((b: any) => b.purpose === 'geotagging'),
  );
}

async function getAllProcessedPlaces(): Promise<GazetteerPlace[]> {
  const now = Date.now();

  if (cachedPlaces && now - cacheTimestamp < CACHE_DURATION) {
    console.log(
      `Returning cached places: ${
        cachedPlaces.length
      } places (cache age: ${Math.round((now - cacheTimestamp) / 60000)}min)`,
    );
    return cachedPlaces;
  }

  try {
    console.log('Cache miss or expired, fetching fresh data...');

    // Start with GAVOC data as a fallback base
    const gavocData = await getCachedGavocData();
    console.log(`Loaded ${gavocData.length} GAVOC places`);

    // Try to fetch a limited set of annotations with strict timeout
    let allAnnotations = { linking: [], geotagging: [] };

    try {
      const annotationPromise = fetchAllAnnotations();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Annotation fetch timeout')), 18000),
      );

      allAnnotations = (await Promise.race([
        annotationPromise,
        timeoutPromise,
      ])) as any;
      console.log(
        `Fetched ${allAnnotations.linking.length} linking and ${allAnnotations.geotagging.length} geotagging annotations`,
      );
    } catch (error) {
      console.warn(
        'Failed to fetch annotations, falling back to GAVOC-only data:',
        error,
      );
      // Continue with GAVOC data only
    }

    cachedPlaces = await processPlaceData(allAnnotations, gavocData);
    cacheTimestamp = now;

    console.log(`Processed ${cachedPlaces.length} total places`);
    return cachedPlaces;
  } catch (error) {
    console.error('Error fetching processed places:', error);

    // Return cached data if available, even if expired
    if (cachedPlaces) {
      console.log('Returning stale cached data due to error');
      return cachedPlaces;
    }

    // Last resort: return GAVOC data only
    try {
      const gavocData = await getCachedGavocData();
      const fallbackPlaces = gavocData.map((item) =>
        convertGavocItemToPlace(item),
      );
      console.log(`Returning ${fallbackPlaces.length} fallback GAVOC places`);
      return fallbackPlaces;
    } catch (fallbackError) {
      console.error('Even GAVOC fallback failed:', fallbackError);
      return [];
    }
  }
}

async function getCachedGavocData(): Promise<any[]> {
  if (cachedGavocData) {
    return cachedGavocData;
  }

  cachedGavocData = await fetchGavocAtlasData();
  return cachedGavocData;
}

export async function fetchAllPlaces({
  search = '',
  startsWith,
  page = 0,
  limit = 50,
  filter = {},
}: {
  search?: string;
  startsWith?: string;
  page?: number;
  limit?: number;
  filter?: GazetteerFilter;
} = {}): Promise<GazetteerSearchResult> {
  try {
    const allPlaces = await getAllProcessedPlaces();

    let filteredPlaces = allPlaces;

    if (search) {
      const searchLower = search.toLowerCase();
      filteredPlaces = allPlaces.filter(
        (place) =>
          place.name.toLowerCase().includes(searchLower) ||
          place.modernName?.toLowerCase().includes(searchLower) ||
          (place.alternativeNames ?? []).some((name) =>
            name.toLowerCase().includes(searchLower),
          ),
      );
    }

    if (startsWith) {
      const startsWithLower = startsWith.toLowerCase();
      filteredPlaces = filteredPlaces.filter((place) =>
        place.name.toLowerCase().startsWith(startsWithLower),
      );
    }

    if (filter.category) {
      filteredPlaces = filteredPlaces.filter(
        (place) => place.category === filter.category,
      );
    }

    if (filter.hasCoordinates) {
      filteredPlaces = filteredPlaces.filter((place) => !!place.coordinates);
    }

    if (filter.hasModernName) {
      filteredPlaces = filteredPlaces.filter((place) => !!place.modernName);
    }

    if (filter.source && filter.source !== 'all') {
      filteredPlaces = filteredPlaces.filter(
        (place) =>
          Array.isArray(place.annotations) &&
          place.annotations.some((ann) => ann.source === filter.source),
      );
    }

    const startIndex = page * limit;
    const endIndex = startIndex + limit;
    const paginatedPlaces = filteredPlaces.slice(startIndex, endIndex);

    return {
      places: paginatedPlaces,
      totalCount: filteredPlaces.length,
      hasMore: endIndex < filteredPlaces.length,
    };
  } catch (error) {
    console.error('Error fetching places:', error);
    return {
      places: [],
      totalCount: 0,
      hasMore: false,
    };
  }
}

export async function fetchPlaceBySlug(
  slug: string,
): Promise<GazetteerPlace | null> {
  try {
    const allPlaces = await getAllProcessedPlaces();
    return (
      allPlaces.find((place) => createSlugFromName(place.name) === slug) || null
    );
  } catch (error) {
    console.error('Error fetching place by slug:', error);
    return null;
  }
}

export async function fetchPlaceCategories(): Promise<PlaceCategory[]> {
  try {
    const now = Date.now();

    if (cachedCategories && now - cacheTimestamp < CACHE_DURATION) {
      return cachedCategories;
    }

    const allPlaces = await getAllProcessedPlaces();
    const categories = new Map<string, number>();

    allPlaces.forEach((place) => {
      const category = place.category || 'Unknown';
      categories.set(category, (categories.get(category) || 0) + 1);
    });

    cachedCategories = Array.from(categories.entries())
      .map(([key, count]) => ({
        key,
        label: formatCategoryLabel(key),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return cachedCategories;
  } catch (error) {
    console.error('Error fetching categories:', error);
    return cachedCategories || [];
  }
}

async function fetchLinkingAnnotationsFromCustomQuery(): Promise<any[]> {
  const allAnnotations: any[] = [];
  let page = 0;
  let hasMore = true;
  const maxRetries = 2; // Reduce retries
  let pagesProcessed = 0;

  while (hasMore && pagesProcessed < MAX_PAGES_PER_REQUEST) {
    let retries = 0;
    let success = false;

    while (retries < maxRetries && !success) {
      try {
        const result = await throttleRequest(async () => {
          const customQueryUrl =
            page === 0
              ? `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==`
              : `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==?page=${page}`;

          const response = await fetch(customQueryUrl, {
            headers: {
              Accept: '*/*',
              'Cache-Control': 'no-cache',
              'User-Agent': 'curl/8.7.1',
            },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return response.json();
        });

        if (result.items && Array.isArray(result.items)) {
          allAnnotations.push(...result.items);
        }

        hasMore = !!result.next;
        success = true;
        page++;
        pagesProcessed++;
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          console.warn(
            `Failed to fetch linking page ${page} after ${maxRetries} retries`,
          );
          hasMore = false;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 500 * retries));
        }
      }
    }
  }

  console.log(
    `Fetched ${allAnnotations.length} linking annotations in ${pagesProcessed} pages`,
  );
  return allAnnotations;
}

async function fetchAllAnnotationsLegacy(): Promise<any[]> {
  const allAnnotations: any[] = [];
  let page = 0;
  let hasMore = true;
  const maxRetries = 3;

  while (hasMore) {
    let retries = 0;
    let success = false;

    while (retries < maxRetries && !success) {
      try {
        const result = await throttleRequest(async () => {
          const response = await fetch(
            `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}/?page=${page}`,
            {
              headers: {
                Accept:
                  'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
                'Cache-Control': 'no-cache',
              },
              signal: AbortSignal.timeout(30000),
            },
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return response.json();
        });

        if (result.items && Array.isArray(result.items)) {
          const linkingAnnotations = result.items.filter(
            (annotation: any) => annotation.motivation === 'linking',
          );

          allAnnotations.push(...linkingAnnotations);
        }

        hasMore = !!result.next;
        success = true;
        page++;

        if (page > 50) {
          break;
        }
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          hasMore = false;
        } else {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, retries) * 1000),
          );
        }
      }
    }
  }

  return allAnnotations;
}

async function fetchGavocAtlasData(): Promise<any[]> {
  try {
    const baseUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : `http://localhost:${process.env.PORT || 3000}`;

    const response = await fetch(`${baseUrl}/gavoc-atlas-index.csv`, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
    if (!response.ok) return [];

    const csvText = await response.text();
    return parseGavocCSV(csvText);
  } catch (error) {
    console.error('Error fetching GAVOC data:', error);
    return [];
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

async function fetchTargetAnnotation(targetId: string): Promise<any | null> {
  try {
    const response = await fetch(targetId, {
      headers: {
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 404) {
        failedTargetIds.add(targetId);
        blacklistCacheTime = Date.now();
      }
      return null;
    }

    return response.json();
  } catch (error) {
    console.warn(`Failed to fetch target annotation ${targetId}:`, error);
    return null;
  }
}

async function fetchMapMetadata(manifestUrl: string): Promise<any | null> {
  try {
    const response = await fetch(manifestUrl, {
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      return null;
    }

    const manifest = await response.json();

    const mapInfo: any = {
      id: manifest.id,
      title: manifest.label?.en?.[0] || 'Unknown Map',
    };

    if (manifest.metadata && Array.isArray(manifest.metadata)) {
      for (const metadata of manifest.metadata) {
        const label = metadata.label?.en?.[0];
        const value = metadata.value?.en?.[0];

        if (label === 'Date') {
          mapInfo.date = value;
        } else if (label === 'Permalink') {
          const match = value?.match(/href="([^"]+)"/);
          mapInfo.permalink = match ? match[1] : value;
        }
      }
    }

    if (manifest.items && manifest.items.length > 0) {
      const canvas = manifest.items[0];
      mapInfo.canvasId = canvas.id;
      mapInfo.canvasLabel = canvas.label?.en?.[0];

      if (canvas.height && canvas.width) {
        mapInfo.dimensions = {
          width: canvas.width,
          height: canvas.height,
        };
      }
    }

    return mapInfo;
  } catch (error) {
    console.warn(`Failed to fetch map metadata for ${manifestUrl}:`, error);
    return null;
  }
}

async function processPlaceData(
  annotationsData: { linking: any[]; geotagging: any[] },
  gavocData: any[],
): Promise<GazetteerPlace[]> {
  const placeMap = new Map<string, GazetteerPlace>();

  let processedCount = 0;
  let skippedCount = 0;
  let targetsFetched = 0;
  let blacklistedSkipped = 0;
  let geotaggedProcessed = 0;
  let annotationsWithoutTargets = 0;
  let annotationsWithFailedTargets = 0;

  console.log(
    `Starting to process ${annotationsData.linking.length} linking annotations and ${annotationsData.geotagging.length} geotagging annotations`,
  );
  console.log(
    `Limits: max ${MAX_LINKING_ANNOTATIONS} linking annotations, max ${MAX_TARGET_FETCHES} target fetches`,
  );

  if (Date.now() - blacklistCacheTime > BLACKLIST_CACHE_DURATION) {
    failedTargetIds.clear();
    blacklistCacheTime = Date.now();
  }

  const textLinkingAnnotations: any[] = [];
  const geotaggedLinkingAnnotations: any[] = [];

  // Limit the number of annotations we process
  const limitedLinkingAnnotations = annotationsData.linking.slice(
    0,
    MAX_LINKING_ANNOTATIONS,
  );

  for (const linkingAnnotation of limitedLinkingAnnotations) {
    const hasGeotaggingBody = linkingAnnotation.body?.some(
      (body: any) => body.purpose === 'geotagging',
    );

    if (hasGeotaggingBody) {
      geotaggedLinkingAnnotations.push(linkingAnnotation);
    } else {
      textLinkingAnnotations.push(linkingAnnotation);
    }
  }

  const geotaggedClusters = new Map<string, any[]>();

  for (const geoLinkingAnnotation of geotaggedLinkingAnnotations) {
    try {
      const geotaggingBody = geoLinkingAnnotation.body?.find(
        (body: any) => body.purpose === 'geotagging',
      );

      if (!geotaggingBody) continue;

      const geoSource = geotaggingBody.source;
      let placeName = '';
      let coordinates: { x: number; y: number } | undefined;

      if (geoSource.label) {
        placeName = geoSource.label;
      } else if (geoSource.properties?.title) {
        placeName = geoSource.properties.title;
      }

      if (geoSource.geometry?.coordinates) {
        coordinates = {
          x: geoSource.geometry.coordinates[0],
          y: geoSource.geometry.coordinates[1],
        };
      } else if (geoSource.properties?.lat && geoSource.properties?.lon) {
        coordinates = {
          x: parseFloat(geoSource.properties.lon),
          y: parseFloat(geoSource.properties.lat),
        };
      } else if (geoSource.defined_by) {
        const pointMatch = geoSource.defined_by.match(
          /POINT\(([^\s]+)\s+([^\)]+)\)/,
        );
        if (pointMatch) {
          coordinates = {
            x: parseFloat(pointMatch[1]),
            y: parseFloat(pointMatch[2]),
          };
        }
      }

      if (placeName && coordinates) {
        const canonicalKey = `${placeName}|${coordinates.x},${coordinates.y}`;

        if (!geotaggedClusters.has(canonicalKey)) {
          geotaggedClusters.set(canonicalKey, []);
        }
        geotaggedClusters.get(canonicalKey)!.push(geoLinkingAnnotation);
      }
    } catch (error) {}
  }

  for (const [canonicalKey, clusterAnnotations] of geotaggedClusters) {
    const primaryAnnotation = clusterAnnotations[0];

    try {
      const geotaggingBody = primaryAnnotation.body?.find(
        (body: any) => body.purpose === 'geotagging',
      );
      const selectingBody = primaryAnnotation.body?.find(
        (body: any) => body.purpose === 'selecting',
      );
      const identifyingBody = primaryAnnotation.body?.find(
        (body: any) => body.purpose === 'identifying',
      );

      if (!geotaggingBody) continue;

      const geoSource = geotaggingBody.source;
      let placeName = '';
      let coordinates: { x: number; y: number } | undefined;
      let modernName: string | undefined;
      let pixelCoordinates: { x: number; y: number } | undefined;

      if (geoSource.label) {
        placeName = geoSource.label;
      } else if (geoSource.properties?.title) {
        placeName = geoSource.properties.title;
      } else if (identifyingBody?.source?.label) {
        placeName = identifyingBody.source.label;
      }

      if (geoSource.geometry?.coordinates) {
        coordinates = {
          x: geoSource.geometry.coordinates[0],
          y: geoSource.geometry.coordinates[1],
        };
      } else if (geoSource.properties?.lat && geoSource.properties?.lon) {
        coordinates = {
          x: parseFloat(geoSource.properties.lon),
          y: parseFloat(geoSource.properties.lat),
        };
      } else if (geoSource.defined_by) {
        const pointMatch = geoSource.defined_by.match(
          /POINT\(([^\s]+)\s+([^\)]+)\)/,
        );
        if (pointMatch) {
          coordinates = {
            x: parseFloat(pointMatch[1]),
            y: parseFloat(pointMatch[2]),
          };
        }
      }

      if (selectingBody?.selector?.type === 'PointSelector') {
        pixelCoordinates = {
          x: selectingBody.selector.x,
          y: selectingBody.selector.y,
        };
      }

      if (geoSource.properties?.display_name) {
        modernName = geoSource.properties.display_name;
      } else if (
        geoSource.properties?.name &&
        geoSource.properties.name !== placeName
      ) {
        modernName = geoSource.properties.name;
      }

      let mapInfo: any = undefined;
      let manifestUrl: string | undefined;
      let canvasUrl: string | undefined;

      if (selectingBody?.source) {
        canvasUrl = selectingBody.source;
        if (canvasUrl) {
          manifestUrl = canvasUrl.replace('/canvas/p1', '');

          try {
            mapInfo = await fetchMapMetadata(manifestUrl);
          } catch (error) {}
        }
      }

      if (placeName) {
        const canonicalPlaceId = `clustered-${canonicalKey}`;

        const clusterLinkingAnnotationIds = clusterAnnotations.map(
          (annotation) => annotation.id,
        );

        const geoPlace: GazetteerPlace = {
          id: canonicalPlaceId,
          name: placeName,
          category: 'place',
          coordinates: coordinates || pixelCoordinates,
          coordinateType: coordinates ? 'geographic' : 'pixel',
          modernName: modernName,
          manifestUrl: manifestUrl,
          canvasUrl: canvasUrl,
          linkingAnnotationId: primaryAnnotation.id,
          creator: primaryAnnotation.creator,
          created: primaryAnnotation.created,
          modified: primaryAnnotation.modified,
          textParts: [],
          isGeotagged: true,
          hasPointSelection: !!pixelCoordinates,
          hasGeotagging: true,
          hasHumanVerification: true,
          targetAnnotationCount: clusterAnnotations.length,
          mapInfo,
          textRecognitionSources: [],
          targetIds: clusterLinkingAnnotationIds,
        };

        placeMap.set(canonicalPlaceId, geoPlace);
        geotaggedProcessed += clusterAnnotations.length;
      }
    } catch (error) {}
  }

  for (const linkingAnnotation of textLinkingAnnotations) {
    if (!linkingAnnotation.target || !Array.isArray(linkingAnnotation.target)) {
      annotationsWithoutTargets++;
      skippedCount++;
      continue;
    }

    // Stop processing if we've fetched too many targets
    if (targetsFetched >= MAX_TARGET_FETCHES) {
      console.log(
        `Reached target fetch limit (${MAX_TARGET_FETCHES}), stopping annotation processing`,
      );
      break;
    }

    if (processedCount % 50 === 0) {
      console.log(
        `Processed ${processedCount} text linking annotations, fetched ${targetsFetched} targets`,
      );
    }

    const textRecognitionSources: Array<{
      text: string;
      source: 'human' | 'ai-pipeline' | 'loghi-htr';
      confidence?: number;
      creator?: any;
      generator?: any;
      created?: string;
      targetId: string;
      isHumanVerified?: boolean;
      verifiedBy?: any;
      verifiedDate?: string;
    }> = [];

    let allTargetsFailed = true;
    let manifestUrl: string | undefined;
    let canvasUrl: string | undefined;
    let mapInfo: any | undefined;

    let hasPointSelection = false;
    let hasGeotagging = false;

    let identifyingBody: any = null;
    let geotaggingBody: any = null;
    let selectingBody: any = null;

    if (linkingAnnotation.body && Array.isArray(linkingAnnotation.body)) {
      for (const body of linkingAnnotation.body) {
        if (body.purpose === 'selecting') {
          hasPointSelection = true;
          selectingBody = body;
        }
        if (body.purpose === 'geotagging') {
          hasGeotagging = true;
          geotaggingBody = body;
        }
        if (body.purpose === 'identifying') {
          identifyingBody = body;
        }
      }
    }

    let canonicalPlaceId: string;
    let canonicalName: string;
    let canonicalCategory: string;
    let geoCoordinates: { x: number; y: number } | undefined;
    let modernName: string | undefined;
    let alternativeNames: string[] | undefined;

    if (geotaggingBody && geotaggingBody.source) {
      const geoSource = geotaggingBody.source;
      canonicalPlaceId = geoSource.uri || geoSource.id || linkingAnnotation.id;
      canonicalName =
        geoSource.properties?.title ||
        geoSource.preferredTerm ||
        'Unknown Place';
      canonicalCategory = (
        geoSource.category ||
        geoSource.properties?.category ||
        'place'
      ).split('/')[0];

      if (geoSource.geometry?.coordinates) {
        geoCoordinates = {
          x: geoSource.geometry.coordinates[0],
          y: geoSource.geometry.coordinates[1],
        };
      } else if (geoSource.coordinates) {
        geoCoordinates = {
          x: geoSource.coordinates.longitude,
          y: geoSource.coordinates.latitude,
        };
      }

      alternativeNames =
        geoSource.alternativeTerms || geoSource.properties?.alternativeTerms;
    } else if (identifyingBody && identifyingBody.source) {
      const identifyingSource = identifyingBody.source;
      canonicalPlaceId =
        identifyingSource.uri || identifyingSource.id || linkingAnnotation.id;
      canonicalName =
        identifyingSource.label ||
        identifyingSource.preferredTerm ||
        'Unknown Place';
      canonicalCategory = (identifyingSource.category || 'place').split('/')[0];
      alternativeNames = identifyingSource.alternativeTerms;
    } else {
      canonicalPlaceId = linkingAnnotation.id;
      canonicalName = '';
      canonicalCategory = 'place';
    }

    for (let i = 0; i < linkingAnnotation.target.length; i++) {
      // Break if we've hit the target fetch limit
      if (targetsFetched >= MAX_TARGET_FETCHES) {
        break;
      }

      const targetUrl = linkingAnnotation.target[i];
      let targetId = '';

      if (typeof targetUrl === 'string') {
        targetId = targetUrl;
      } else if (targetUrl.source) {
        targetId = targetUrl.source;
      } else if (targetUrl.id) {
        targetId = targetUrl.id;
      }

      if (!targetId) continue;

      if (failedTargetIds.has(targetId)) {
        blacklistedSkipped++;
        if (blacklistedSkipped % 100 === 0) {
          console.log(`Skipped ${blacklistedSkipped} blacklisted targets`);
        }
        continue;
      }

      const targetAnnotation = await fetchTargetAnnotation(targetId);
      targetsFetched++;

      if (!targetAnnotation) {
        continue;
      }

      if (targetAnnotation.motivation !== 'textspotting') {
        continue;
      }

      allTargetsFailed = false;

      let isHumanVerified = false;
      let verifiedBy: any = undefined;
      let verifiedDate: string | undefined = undefined;

      if (targetAnnotation.body && Array.isArray(targetAnnotation.body)) {
        const assessingBody = targetAnnotation.body.find(
          (body: any) =>
            body.purpose === 'assessing' && body.value === 'checked',
        );

        if (assessingBody) {
          isHumanVerified = true;
          verifiedBy = assessingBody.creator;
          verifiedDate = assessingBody.created;
        }
      }

      if (targetAnnotation.body && Array.isArray(targetAnnotation.body)) {
        for (const body of targetAnnotation.body) {
          if (body.value && typeof body.value === 'string') {
            if (body.purpose === 'assessing' && body.value === 'checked') {
              continue;
            }

            let source: 'human' | 'ai-pipeline' | 'loghi-htr' = 'ai-pipeline';

            if (body.creator) {
              source = 'human';
            } else if (body.generator) {
              if (
                body.generator.label &&
                body.generator.label.includes('Loghi')
              ) {
                source = 'loghi-htr';
              } else {
                source = 'ai-pipeline';
              }
            }

            textRecognitionSources.push({
              text: body.value.trim(),
              source,
              creator: body.creator,
              generator: body.generator,
              created: body.created,
              targetId: targetId,
              isHumanVerified,
              verifiedBy,
              verifiedDate,
            });
          }
        }
      }

      if (!manifestUrl && targetAnnotation.target?.source) {
        canvasUrl = targetAnnotation.target.source;
        if (canvasUrl) {
          manifestUrl = canvasUrl.replace('/canvas/p1', '');

          try {
            mapInfo = await fetchMapMetadata(manifestUrl);
          } catch (error) {}
        }
      }
    }

    if (
      allTargetsFailed &&
      textRecognitionSources.length === 0 &&
      !geotaggingBody
    ) {
      annotationsWithFailedTargets++;
      skippedCount++;
      continue;
    }

    if (!canonicalName && textRecognitionSources.length > 0) {
      const textsByTarget = new Map<
        string,
        Array<{
          text: string;
          source: string;
          priority: number;
        }>
      >();

      for (const src of textRecognitionSources) {
        const priority =
          src.source === 'human' ? 1 : src.source === 'loghi-htr' ? 2 : 3;

        if (!textsByTarget.has(src.targetId)) {
          textsByTarget.set(src.targetId, []);
        }

        textsByTarget.get(src.targetId)!.push({
          text: src.text.trim(),
          source: src.source,
          priority,
        });
      }

      const bestTextsFromEachTarget: string[] = [];

      for (const [targetId, texts] of textsByTarget.entries()) {
        const bestText = texts.sort((a, b) => a.priority - b.priority)[0];

        if (bestText && bestText.text) {
          bestTextsFromEachTarget.push(bestText.text);
        }
      }

      canonicalName = bestTextsFromEachTarget.join(' ').trim();

      if (canonicalPlaceId === linkingAnnotation.id && canonicalName) {
        const normalizedText = canonicalName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]/g, '-');
        canonicalPlaceId = `text-based-${normalizedText}`;
      }
    }

    let pixelCoordinates: { x: number; y: number } | undefined;
    if (selectingBody && selectingBody.selector?.type === 'PointSelector') {
      pixelCoordinates = {
        x: selectingBody.selector.x,
        y: selectingBody.selector.y,
      };
    }

    const hasHumanVerification = textRecognitionSources.some(
      (source) => source.isHumanVerified,
    );

    let place = placeMap.get(canonicalPlaceId);

    if (place) {
      if (place.textRecognitionSources) {
        const allSources = [
          ...place.textRecognitionSources,
          ...textRecognitionSources,
        ];
        place.textRecognitionSources =
          deduplicateTextRecognitionSources(allSources);
      } else {
        place.textRecognitionSources = deduplicateTextRecognitionSources(
          textRecognitionSources,
        );
      }

      place.targetAnnotationCount =
        (place.targetAnnotationCount || 0) + linkingAnnotation.target.length;

      if (hasHumanVerification) {
        place.hasHumanVerification = true;
      }

      if (mapInfo) {
        if (!place.mapReferences) {
          place.mapReferences = [];
        }
        place.mapReferences.push({
          mapId: mapInfo.id,
          mapTitle: mapInfo.title,
          canvasId: mapInfo.canvasId || '',
        });
      }
    } else {
      place = {
        id: canonicalPlaceId,
        name: canonicalName || 'Unknown Place',
        category: canonicalCategory,
        coordinates: geoCoordinates || pixelCoordinates,
        coordinateType: geoCoordinates ? 'geographic' : 'pixel',
        alternativeNames: alternativeNames,
        modernName: modernName,
        manifestUrl: manifestUrl,
        canvasUrl: canvasUrl,
        targetIds: linkingAnnotation.target,
        linkingAnnotationId: linkingAnnotation.id,
        creator: linkingAnnotation.creator,
        created: linkingAnnotation.created,
        modified: linkingAnnotation.modified,
        textParts: textRecognitionSources.map((src) => ({
          value: src.text,
          source: src.source === 'human' ? 'creator' : 'loghi',
          targetId: src.targetId,
        })),
        isGeotagged: hasGeotagging,
        hasPointSelection,
        hasGeotagging,
        hasHumanVerification,
        targetAnnotationCount: linkingAnnotation.target.length,
        mapInfo,
        textRecognitionSources: deduplicateTextRecognitionSources(
          textRecognitionSources,
        ),
      };

      placeMap.set(canonicalPlaceId, place);
    }

    processedCount++;
  }

  for (const geoAnnotation of annotationsData.geotagging) {
    try {
      if (geoAnnotation.body && geoAnnotation.body.value) {
        const geoPlace: GazetteerPlace = {
          id: geoAnnotation.id,
          name: geoAnnotation.body.value,
          category: geoAnnotation.body.category || 'place',
          coordinates:
            geoAnnotation.body.latitude && geoAnnotation.body.longitude
              ? {
                  x: geoAnnotation.body.longitude,
                  y: geoAnnotation.body.latitude,
                }
              : undefined,
          coordinateType: 'geographic',
          creator: geoAnnotation.creator,
          created: geoAnnotation.created,
          modified: geoAnnotation.modified,
          annotations: [geoAnnotation.id],
          textParts: [],
          isGeotagged: true,
          hasGeotagging: true,
          targetAnnotationCount: 0,
        };

        const geoKey = `geo_${geoAnnotation.id}`;
        placeMap.set(geoKey, geoPlace);
      }
    } catch (error) {}
  }

  const places = Array.from(placeMap.values());

  console.log(
    `Processing complete: ${places.length} places, ${processedCount} linking annotations processed, ${geotaggedProcessed} geotagged processed, ${targetsFetched} targets fetched, ${skippedCount} skipped`,
  );

  return places;
}

function enrichPlaceWithGavocData(
  place: GazetteerPlace,
  gavocMatches: any[],
): void {
  const primaryGavoc = gavocMatches[0];

  if (primaryGavoc.category && primaryGavoc.category !== 'place') {
    place.category = primaryGavoc.category;
  }

  if (!place.coordinates && primaryGavoc.coordinates) {
    place.coordinates = primaryGavoc.coordinates;
  }

  const modernName = primaryGavoc['Tegenwoordige naam/Present name'];
  if (modernName && modernName !== '-') {
    place.modernName = modernName;
  }

  for (const gavocItem of gavocMatches) {
    if (!place.mapReferences) {
      place.mapReferences = [];
    }
    place.mapReferences.push({
      mapId: gavocItem['Kaart/Map'] || '',
      mapTitle: gavocItem['Kaart/Map'] || '',
      canvasId: '',
      gridSquare: gavocItem['Kaartvak/Map grid square'],
      pageNumber: gavocItem['Pagina/Page'],
    });
  }

  const allNames = new Set([place.name]);
  for (const gavocItem of gavocMatches) {
    const originalName =
      gavocItem['Oorspr. naam op de kaart/Original name on the map'];
    const modernName = gavocItem['Tegenwoordige naam/Present name'];

    if (originalName && originalName !== '-' && originalName !== place.name) {
      allNames.add(originalName);
    }
    if (modernName && modernName !== '-' && modernName !== place.name) {
      allNames.add(modernName);
    }
  }

  if (!place.alternativeNames) {
    place.alternativeNames = [];
  }

  place.alternativeNames = Array.from(allNames).filter(
    (name) => name !== place.name,
  );
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

function getCanvasId(target: any): string {
  if (!target) return '';
  if (typeof target === 'string') return target;
  if (Array.isArray(target) && target.length > 0) {
    return getCanvasId(target[0]);
  }
  return target.source?.id || target.source || target.id || '';
}

function getManifestId(target: any): string {
  const canvasId = getCanvasId(target);
  const match = canvasId.match(/^(.*\/manifests\/[^\/]+)/);
  return match ? match[1] : '';
}

function extractCoordinatesFromSelector(selector: any): {
  x: number;
  y: number;
} {
  if (!selector?.value) return { x: 0, y: 0 };

  const match = selector.value.match(/points="([^"]+)"/);
  if (!match) return { x: 0, y: 0 };

  const points = match[1].split(' ')[0].split(',');
  return {
    x: parseInt(points[0]) || 0,
    y: parseInt(points[1]) || 0,
  };
}

function formatCategoryLabel(category: string): string {
  const categoryMap: Record<string, string> = {
    place: 'Place',
    plaats: 'Settlement',
    eiland: 'Island',
    rivier: 'River',
    berg: 'Mountain',
    kaap: 'Cape',
    baai: 'Bay',
    meer: 'Lake',
    landstreek: 'Region',
    gebouw: 'Building',
    ondiepte: 'Shoals',
    rif: 'Reef',
    voorde: 'Ford',
    lagune: 'Lagoon',
    wijk: 'District',
  };

  return categoryMap[category] || category;
}

export function createSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function deduplicateTextRecognitionSources(
  sources: Array<{
    text: string;
    source: 'human' | 'ai-pipeline' | 'loghi-htr';
    confidence?: number;
    creator?: any;
    generator?: any;
    created?: string;
    targetId: string;
    isHumanVerified?: boolean;
    verifiedBy?: any;
    verifiedDate?: string;
  }>,
): typeof sources {
  const textMap = new Map<string, (typeof sources)[0] & { priority: number }>();

  for (const src of sources) {
    const normalizedText = src.text.toLowerCase().trim();
    const priority =
      src.source === 'human' ? 1 : src.source === 'loghi-htr' ? 2 : 3;

    if (
      !textMap.has(normalizedText) ||
      textMap.get(normalizedText)!.priority > priority
    ) {
      textMap.set(normalizedText, { ...src, priority });
    }
  }

  return Array.from(textMap.values()).map(({ priority, ...rest }) => rest);
}

export function invalidateCache(): void {
  cachedPlaces = null;
  cachedCategories = null;
  cachedGavocData = null;
  cacheTimestamp = 0;
  failedTargetIds.clear();
  blacklistCacheTime = 0;
}

invalidateCache();

export function getCacheStatus(): {
  isValid: boolean;
  ageMinutes: number;
  hasData: boolean;
  blacklistSize: number;
  blacklistAgeMinutes: number;
} {
  const now = Date.now();
  const age = now - cacheTimestamp;
  const blacklistAge = now - blacklistCacheTime;
  return {
    isValid: age < CACHE_DURATION,
    ageMinutes: Math.round(age / (1000 * 60)),
    hasData: !!cachedPlaces,
    blacklistSize: failedTargetIds.size,
    blacklistAgeMinutes: Math.round(blacklistAge / (1000 * 60)),
  };
}

export function clearBlacklist(): void {
  failedTargetIds.clear();
  blacklistCacheTime = 0;
}

export function getBlacklistedTargets(): string[] {
  return Array.from(failedTargetIds);
}

function convertGavocItemToPlace(gavocItem: any): GazetteerPlace {
  return {
    id: `gavoc-${
      gavocItem['Oorspr. naam op de kaart/Original name on the map'] ||
      'unknown'
    }`,
    name:
      gavocItem['Oorspr. naam op de kaart/Original name on the map'] ||
      'Unknown',
    category: gavocItem.category || 'place',
    coordinates: gavocItem.coordinates,
    coordinateType: gavocItem.coordinates ? 'geographic' : undefined,
    modernName:
      gavocItem['Tegenwoordige naam/Present name'] !== '-'
        ? gavocItem['Tegenwoordige naam/Present name']
        : undefined,
    textParts: [],
    targetAnnotationCount: 0,
    textRecognitionSources: [],
    isGeotagged: !!gavocItem.coordinates,
    hasGeotagging: !!gavocItem.coordinates,
    hasHumanVerification: true, // GAVOC data is human-verified
  };
}

export async function testDataSources(): Promise<{
  customQuery: { count: number; sample: any[] };
  legacy: { count: number; sample: any[] };
}> {
  try {
    const [customQueryData, legacyData] = await Promise.all([
      fetchLinkingAnnotationsFromCustomQuery(),
      fetchAllAnnotationsLegacy(),
    ]);

    return {
      customQuery: {
        count: customQueryData.length,
        sample: customQueryData.slice(0, 3),
      },
      legacy: {
        count: legacyData.length,
        sample: legacyData.slice(0, 3),
      },
    };
  } catch (error) {
    console.error('Error testing data sources:', error);
    throw error;
  }
}

export function setDataSource(source: 'custom' | 'legacy'): void {}
