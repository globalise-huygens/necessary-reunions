import type {
  GazetteerFilter,
  GazetteerPlace,
  GazetteerSearchResult,
  PlaceCategory,
} from './types';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

const CACHE_DURATION = 60 * 60 * 1000;
const MAX_PAGES_PER_REQUEST = 100;
const REQUEST_TIMEOUT = 4000;
const MAX_LINKING_ANNOTATIONS = 1000;
const MAX_TARGET_FETCHES = 600;
const MAX_CONCURRENT_REQUESTS = 6;
const PROCESSING_TIME_LIMIT = 20000;

const COORDINATE_PRECISION = 4;
const PROGRESSIVE_BATCH_SIZE = 50;

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
  const maxRetries = 2;
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

  return allAnnotations;
}

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
    return cachedPlaces;
  }

  try {
    let allAnnotations = { linking: [], geotagging: [] };

    try {
      const annotationPromise = fetchAllAnnotations();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Annotation fetch timeout')), 12000),
      );

      allAnnotations = (await Promise.race([
        annotationPromise,
        timeoutPromise,
      ])) as any;
    } catch (error) {
      console.warn('Failed to fetch annotations from AnnoRepo:', error);
      return [];
    }

    const gavocData = await getCachedGavocData();
    cachedPlaces = await processPlaceData(allAnnotations, gavocData);
    cacheTimestamp = now;
    return cachedPlaces;
  } catch (error) {
    console.error('Error fetching processed places:', error);

    if (cachedPlaces) {
    }

    console.error('No cached data available and AnnoRepo failed');
    return [];
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
  const maxRetries = 2;
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
    let baseUrl: string;

    if (typeof window !== 'undefined') {
      baseUrl = window.location.origin;
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else if (process.env.NETLIFY && process.env.DEPLOY_PRIME_URL) {
      baseUrl = process.env.DEPLOY_PRIME_URL;
    } else if (process.env.NETLIFY && process.env.URL) {
      baseUrl = process.env.URL;
    } else {
      baseUrl = `http://localhost:${process.env.PORT || 3000}`;
    }

    const response = await fetch(`${baseUrl}/gavoc-atlas-index.csv`, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });

    if (!response.ok) return [];

    const csvText = await response.text();
    const parsedData = parseGavocCSV(csvText);
    return parsedData;
  } catch (error) {
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

  const processingStartTime = Date.now();

  if (Date.now() - blacklistCacheTime > BLACKLIST_CACHE_DURATION) {
    failedTargetIds.clear();
    blacklistCacheTime = Date.now();
  }

  const textLinkingAnnotations: any[] = [];
  const geotaggedLinkingAnnotations: any[] = [];

  const sortedLinkingAnnotations = annotationsData.linking.sort((a, b) => {
    const aHasGeotagging = a.body?.some(
      (body: any) => body.purpose === 'geotagging',
    )
      ? 1
      : 0;
    const bHasGeotagging = b.body?.some(
      (body: any) => body.purpose === 'geotagging',
    )
      ? 1
      : 0;
    return bHasGeotagging - aHasGeotagging;
  });

  const limitedLinkingAnnotations = sortedLinkingAnnotations.slice(
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
    const elapsedTime = Date.now() - processingStartTime;
    if (elapsedTime > PROCESSING_TIME_LIMIT) {
      break;
    }

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
        const roundedX = parseFloat(
          coordinates.x.toFixed(COORDINATE_PRECISION),
        );
        const roundedY = parseFloat(
          coordinates.y.toFixed(COORDINATE_PRECISION),
        );

        const normalizedName = placeName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]/g, '');

        const canonicalKey = `${normalizedName}|${roundedX},${roundedY}`;

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
      let placeCategory = 'place';
      let coordinates: { x: number; y: number } | undefined;
      let modernName: string | undefined;
      let alternativeNames: string[] | undefined;
      let pixelCoordinates: { x: number; y: number } | undefined;

      // Extract place name - prioritize GAVOC preferredTerm
      if (geoSource.preferredTerm) {
        placeName = geoSource.preferredTerm;
      } else if (geoSource.label) {
        placeName = geoSource.label;
      } else if (geoSource.properties?.title) {
        placeName = geoSource.properties.title;
      } else if (identifyingBody?.source?.label) {
        placeName = identifyingBody.source.label;
      } else if (identifyingBody?.source?.preferredTerm) {
        placeName = identifyingBody.source.preferredTerm;
      }

      // Extract category from GAVOC data
      if (geoSource.category) {
        placeCategory = geoSource.category.split('/')[0];
      } else if (geoSource.properties?.category) {
        placeCategory = geoSource.properties.category.split('/')[0];
      } else if (identifyingBody?.source?.category) {
        placeCategory = identifyingBody.source.category.split('/')[0];
      }

      // Extract alternative names from GAVOC data
      if (geoSource.alternativeTerms) {
        alternativeNames = geoSource.alternativeTerms;
      } else if (geoSource.properties?.alternativeTerms) {
        alternativeNames = geoSource.properties.alternativeTerms;
      } else if (identifyingBody?.source?.alternativeTerms) {
        alternativeNames = identifyingBody.source.alternativeTerms;
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

        const mapReferences: Array<{
          mapId: string;
          mapTitle: string;
          canvasId: string;
          linkingAnnotationId: string;
        }> = [];

        for (const annotation of clusterAnnotations) {
          const selectingBodyForMap = annotation.body?.find(
            (body: any) => body.purpose === 'selecting',
          );

          if (selectingBodyForMap?.source) {
            const canvasUrlForMap = selectingBodyForMap.source;
            const manifestUrlForMap = canvasUrlForMap.replace('/canvas/p1', '');

            try {
              const mapInfoForMap = await fetchMapMetadata(manifestUrlForMap);
              if (mapInfoForMap) {
                mapReferences.push({
                  mapId: mapInfoForMap.id,
                  mapTitle: mapInfoForMap.title,
                  canvasId: mapInfoForMap.canvasId || '',
                  linkingAnnotationId: annotation.id,
                });
              }
            } catch (error) {}
          }
        }

        const geoPlace: GazetteerPlace = {
          id: canonicalPlaceId,
          name: placeName,
          category: placeCategory,
          coordinates: coordinates || pixelCoordinates,
          coordinateType: coordinates ? 'geographic' : 'pixel',
          alternativeNames: alternativeNames,
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
          mapReferences: mapReferences,
          textRecognitionSources: [],
          targetIds: clusterLinkingAnnotationIds,
        };

        placeMap.set(canonicalPlaceId, geoPlace);
        geotaggedProcessed += clusterAnnotations.length;
      }
    } catch (error) {}
  }

  for (const linkingAnnotation of textLinkingAnnotations) {
    const elapsedTime = Date.now() - processingStartTime;
    if (elapsedTime > PROCESSING_TIME_LIMIT) {
      break;
    }

    if (!linkingAnnotation.target || !Array.isArray(linkingAnnotation.target)) {
      annotationsWithoutTargets++;
      skippedCount++;
      continue;
    }

    if (targetsFetched >= MAX_TARGET_FETCHES) {
      break;
    }

    if (processedCount % 100 === 0 && processedCount > 0) {
      const currentElapsed = Date.now() - processingStartTime;
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

      // Try multiple fields for the place name - prioritize GAVOC preferredTerm
      canonicalName =
        geoSource.preferredTerm ||
        geoSource.label ||
        geoSource.properties?.title ||
        geoSource.properties?.name ||
        geoSource.properties?.display_name ||
        'Unknown Place';

      // Extract category, prioritizing the first part before slash
      canonicalCategory = (
        geoSource.category ||
        geoSource.properties?.category ||
        geoSource.properties?.place_rank ||
        'place'
      )
        .toString()
        .split('/')[0];

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
      } else if (geoSource.properties?.lat && geoSource.properties?.lon) {
        geoCoordinates = {
          x: parseFloat(geoSource.properties.lon),
          y: parseFloat(geoSource.properties.lat),
        };
      }

      // Try to get modern name from OpenStreetMap data
      if (geoSource.properties?.display_name) {
        modernName = geoSource.properties.display_name;
      } else if (
        geoSource.properties?.name &&
        geoSource.properties.name !== canonicalName
      ) {
        modernName = geoSource.properties.name;
      }

      alternativeNames =
        geoSource.alternativeTerms || geoSource.properties?.alternativeTerms;
    } else if (identifyingBody && identifyingBody.source) {
      const identifyingSource = identifyingBody.source;
      canonicalPlaceId =
        identifyingSource.uri || identifyingSource.id || linkingAnnotation.id;
      canonicalName =
        identifyingSource.preferredTerm ||
        identifyingSource.label ||
        'Unknown Place';
      canonicalCategory = (identifyingSource.category || 'place').split('/')[0];
      alternativeNames = identifyingSource.alternativeTerms;
    } else {
      canonicalPlaceId = linkingAnnotation.id;
      canonicalName = '';
      canonicalCategory = 'place';
    }

    for (let i = 0; i < linkingAnnotation.target.length; i++) {
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

  const processingEndTime = Date.now();
  const totalProcessingTime = processingEndTime - processingStartTime;

  return places;
}

function findGavocMatches(placeName: string, gavocData: any[]): any[] {
  if (!placeName || !gavocData.length) return [];

  const normalizedSearchName = normalizeText(placeName);
  const matches: any[] = [];

  for (const item of gavocData) {
    const originalName =
      item['Oorspr. naam op de kaart/Original name on the map'];
    const presentName = item['Tegenwoordige naam/Present name'];

    if (originalName && normalizeText(originalName) === normalizedSearchName) {
      matches.push(item);
    } else if (
      presentName &&
      presentName !== '-' &&
      normalizeText(presentName) === normalizedSearchName
    ) {
      matches.push(item);
    }
  }

  return matches;
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
    hasHumanVerification: true,
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

export async function fetchAllPlacesProgressive({
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
  const originalMaxTarget = MAX_TARGET_FETCHES;
  const originalMaxLinking = MAX_LINKING_ANNOTATIONS;

  const PROGRESSIVE_MAX_TARGET_FETCHES = 150;
  const PROGRESSIVE_MAX_LINKING_ANNOTATIONS = 300;

  try {
    invalidateCache();

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
    console.error('Error fetching places progressively:', error);
    return {
      places: [],
      totalCount: 0,
      hasMore: false,
    };
  }
}

export async function fetchGavocPlaces({
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
    const gavocData = await getCachedGavocData();
    const gavocPlaces = gavocData.map((item) => convertGavocItemToPlace(item));

    let filteredPlaces = gavocPlaces;

    if (search) {
      const searchLower = search.toLowerCase();
      filteredPlaces = gavocPlaces.filter(
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

    const startIndex = page * limit;
    const endIndex = startIndex + limit;
    const paginatedPlaces = filteredPlaces.slice(startIndex, endIndex);

    return {
      places: paginatedPlaces,
      totalCount: filteredPlaces.length,
      hasMore: endIndex < filteredPlaces.length,
    };
  } catch (error) {
    console.error('Error fetching GAVOC places:', error);
    return {
      places: [],
      totalCount: 0,
      hasMore: false,
    };
  }
}

export async function fetchGavocPlaceCategories(): Promise<PlaceCategory[]> {
  try {
    const gavocData = await getCachedGavocData();
    const gavocPlaces = gavocData.map((item) => convertGavocItemToPlace(item));

    const categories = new Map<string, number>();

    gavocPlaces.forEach((place) => {
      const category = place.category || 'Unknown';
      categories.set(category, (categories.get(category) || 0) + 1);
    });

    const gavocCategories = Array.from(categories.entries())
      .map(([key, count]) => ({
        key,
        label: formatCategoryLabel(key),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return gavocCategories;
  } catch (error) {
    console.error('Error fetching GAVOC categories:', error);
    return [];
  }
}
