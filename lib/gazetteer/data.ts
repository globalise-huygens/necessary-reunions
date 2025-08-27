import type {
  GazetteerFilter,
  GazetteerPlace,
  GazetteerSearchResult,
  PlaceCategory,
} from './types';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

async function fetchAllAnnotations(): Promise<{
  linking: any[];
  geotagging: any[];
}> {
  // Fetch both linking and geotagging annotations
  const linkingAnnotations = await fetchLinkingAnnotationsFromCustomQuery();
  const geotaggingAnnotations =
    await fetchGeotaggingAnnotationsFromCustomQuery();

  console.log(`Found ${linkingAnnotations.length} linking annotations`);
  console.log(`Found ${geotaggingAnnotations.length} geotagging annotations`);

  return { linking: linkingAnnotations, geotagging: geotaggingAnnotations };
}

async function fetchGeotaggingAnnotationsFromCustomQuery(): Promise<any[]> {
  const allAnnotations: any[] = [];
  let page = 1;
  let hasMore = true;
  const maxRetries = 3;

  console.log('Fetching geotagging annotations from custom query endpoint...');

  while (hasMore) {
    let retries = 0;
    let success = false;

    while (retries < maxRetries && !success) {
      try {
        const result = await throttleRequest(async () => {
          // Base64 encode "geotagging"
          const customQueryUrl = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=Z2VvdGFnZ2luZw==?page=${page}`;
          console.log(`Fetching geotagging page ${page}: ${customQueryUrl}`);

          const response = await fetch(customQueryUrl, {
            headers: {
              Accept: 'application/json',
              'Cache-Control': 'no-cache',
            },
            signal: AbortSignal.timeout(30000),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return response.json();
        });

        if (result.items && Array.isArray(result.items)) {
          console.log(
            `Geotagging page ${page}: Found ${result.items.length} annotations`,
          );
          allAnnotations.push(...result.items);
        }

        hasMore = !!result.next;
        success = true;
        page++;
      } catch (error) {
        retries++;
        console.warn(
          `Error fetching geotagging page ${page}, retry ${retries}:`,
          error,
        );

        if (retries >= maxRetries) {
          console.error(
            `Failed to fetch geotagging page ${page} after ${maxRetries} retries`,
          );
          hasMore = false;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
        }
      }
    }
  }

  console.log(`Total geotagging annotations fetched: ${allAnnotations.length}`);
  return allAnnotations;
}

const MAX_CONCURRENT_REQUESTS = 10;

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
  console.log(`Total annotations found: ${annotations.length}`);

  const motivations = new Map<string, number>();
  annotations.forEach((ann) => {
    const motivation = ann.motivation || 'undefined';
    motivations.set(motivation, (motivations.get(motivation) || 0) + 1);
  });

  console.log('Motivations found:', Object.fromEntries(motivations));

  const linkingAnnotations = annotations.filter(
    (ann) => ann.motivation === 'linking',
  );
  console.log(`Linking annotations: ${linkingAnnotations.length}`);

  if (linkingAnnotations.length > 0) {
    console.log('Sample linking annotation structure:');
    console.log(
      JSON.stringify(
        linkingAnnotations.slice(
          0,
          Math.min(sampleSize, linkingAnnotations.length),
        ),
        null,
        2,
      ),
    );
  }
}

async function getAllProcessedPlaces(): Promise<GazetteerPlace[]> {
  const now = Date.now();

  if (cachedPlaces && now - cacheTimestamp < CACHE_DURATION) {
    return cachedPlaces;
  }

  try {
    const [allAnnotations, gavocData] = await Promise.all([
      fetchAllAnnotations(),
      getCachedGavocData(),
    ]);

    console.log('=== DEBUGGING GAZETTEER DATA ===');
    debugAnnotations(allAnnotations.linking); // Debug only linking annotations for now

    cachedPlaces = await processPlaceData(allAnnotations, gavocData);
    cacheTimestamp = now;

    console.log(`Processed places: ${cachedPlaces.length}`);
    if (cachedPlaces.length > 0) {
      console.log(
        'Sample places:',
        cachedPlaces.slice(0, 3).map((p) => ({
          name: p.name,
          category: p.category,
          coordinates: p.coordinates,
        })),
      );
    }

    return cachedPlaces;
  } catch (error) {
    console.error('Error fetching processed places:', error);
    return cachedPlaces || [];
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
  let page = 1; // Custom query uses 1-based pagination
  let hasMore = true;
  const maxRetries = 3;

  console.log('Fetching linking annotations from custom query endpoint...');

  while (hasMore) {
    let retries = 0;
    let success = false;

    while (retries < maxRetries && !success) {
      try {
        const result = await throttleRequest(async () => {
          const customQueryUrl = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==?page=${page}`;
          console.log(`Fetching page ${page}: ${customQueryUrl}`);

          const response = await fetch(customQueryUrl, {
            headers: {
              Accept: 'application/json',
              'Cache-Control': 'no-cache',
            },
            signal: AbortSignal.timeout(30000),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return response.json();
        });

        if (result.items && Array.isArray(result.items)) {
          console.log(
            `Page ${page}: Found ${result.items.length} linking annotations`,
          );
          allAnnotations.push(...result.items);
        }

        // Check for next page
        hasMore = !!result.next;
        success = true;
        page++;
      } catch (error) {
        retries++;
        console.warn(`Error fetching page ${page}, retry ${retries}:`, error);

        if (retries >= maxRetries) {
          console.error(
            `Failed to fetch page ${page} after ${maxRetries} retries`,
          );
          hasMore = false;
        } else {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, retries) * 1000),
          );
        }
      }
    }
  }

  console.log(`Total linking annotations fetched: ${allAnnotations.length}`);
  return allAnnotations;
}

// Legacy function for fallback if needed
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
      } catch (error) {
        retries++;
        console.warn(`Error fetching page ${page}, retry ${retries}:`, error);

        if (retries >= maxRetries) {
          console.error(
            `Failed to fetch page ${page} after ${maxRetries} retries`,
          );
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
    console.log(`Fetching target annotation: ${targetId}`);
    const response = await fetch(targetId, {
      headers: {
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`Target annotation ${targetId} returned ${response.status}`);

      if (response.status === 404) {
        failedTargetIds.add(targetId);
        blacklistCacheTime = Date.now();
        console.log(`Added ${targetId} to blacklist (404)`);
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
    console.log(`Fetching map metadata: ${manifestUrl}`);
    const response = await fetch(manifestUrl, {
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`Map metadata ${manifestUrl} returned ${response.status}`);
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
    console.warn(`Failed to fetch map metadata ${manifestUrl}:`, error);
    return null;
  }
}

async function processPlaceData(
  annotationsData: { linking: any[]; geotagging: any[] },
  gavocData: any[],
): Promise<GazetteerPlace[]> {
  const placeMap = new Map<string, GazetteerPlace>();

  console.log(
    `Processing ${annotationsData.linking.length} linking annotations...`,
  );
  console.log(
    `Processing ${annotationsData.geotagging.length} geotagging annotations...`,
  );

  // For now, process only linking annotations (geotagging will be added later)
  // TODO: Add geotagging processing

  console.log(
    'Processing ALL linking annotations with enhanced metadata extraction',
  );
  let processedCount = 0;
  let skippedCount = 0;
  let targetsFetched = 0;
  let blacklistedSkipped = 0;

  if (Date.now() - blacklistCacheTime > BLACKLIST_CACHE_DURATION) {
    failedTargetIds.clear();
    blacklistCacheTime = Date.now();
    console.log('Cleared expired blacklist');
  }

  console.log(`Blacklist contains ${failedTargetIds.size} failed target IDs`);

  // Process ALL annotations (removed the artificial limit)
  console.log(
    `Processing all ${annotationsData.linking.length} linking annotations`,
  );

  for (const linkingAnnotation of annotationsData.linking) {
    if (!linkingAnnotation.target || !Array.isArray(linkingAnnotation.target)) {
      skippedCount++;
      continue;
    }

    console.log(
      `Processing linking annotation ${linkingAnnotation.id} with ${linkingAnnotation.target.length} targets`,
    );

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

    if (linkingAnnotation.body && Array.isArray(linkingAnnotation.body)) {
      for (const body of linkingAnnotation.body) {
        if (body.purpose === 'selecting') {
          hasPointSelection = true;
        }
        if (body.purpose === 'geotagging') {
          hasGeotagging = true;
        }
      }
    }

    for (let i = 0; i < linkingAnnotation.target.length; i++) {
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
        console.log(`Skipping blacklisted target ${targetId} (position ${i})`);
        continue;
      }

      console.log(
        `Fetching target ${i + 1}/${
          linkingAnnotation.target.length
        }: ${targetId}`,
      );

      const targetAnnotation = await fetchTargetAnnotation(targetId);
      targetsFetched++;

      if (!targetAnnotation) {
        console.log(`Failed to fetch target annotation ${targetId}`);
        continue;
      }

      if (targetAnnotation.motivation !== 'textspotting') {
        console.log(
          `Skipping target ${targetId} with motivation: ${targetAnnotation.motivation}`,
        );
        continue;
      }

      allTargetsFailed = false;

      // Check for human verification through assessing bodies
      let isHumanVerified = false;
      let verifiedBy: any = undefined;
      let verifiedDate: string | undefined = undefined;

      if (targetAnnotation.body && Array.isArray(targetAnnotation.body)) {
        // Look for assessing body with "checked" value
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

            console.log(
              `Added text recognition: "${body.value.trim()}" from ${source}`,
            );
          }
        }
      }

      if (!manifestUrl && targetAnnotation.target?.source) {
        canvasUrl = targetAnnotation.target.source;
        if (canvasUrl) {
          manifestUrl = canvasUrl.replace('/canvas/p1', '');
          console.log(`Extracted manifest URL: ${manifestUrl}`);

          // Fetch map metadata
          try {
            mapInfo = await fetchMapMetadata(manifestUrl);
            console.log(
              `Fetched map metadata for: ${mapInfo?.title || 'Unknown'}`,
            );
          } catch (error) {
            console.warn(
              `Failed to fetch map metadata for ${manifestUrl}:`,
              error,
            );
          }
        }
      }
    }

    if (allTargetsFailed || textRecognitionSources.length === 0) {
      console.log(
        `Skipping linking annotation ${linkingAnnotation.id} - no valid text found`,
      );
      skippedCount++;
      continue;
    }

    const humanTexts = textRecognitionSources
      .filter((src) => src.source === 'human')
      .map((src) => src.text);

    const aiTexts = textRecognitionSources
      .filter((src) => src.source !== 'human')
      .map((src) => src.text);

    const completeName =
      humanTexts.length > 0 ? humanTexts.join(' ') : aiTexts.join(' ');

    console.log(
      `Built complete place name: "${completeName}" from ${textRecognitionSources.length} sources (${humanTexts.length} human, ${aiTexts.length} AI)`,
    );

    let coordinates: { x: number; y: number } | undefined;
    if (linkingAnnotation.body && Array.isArray(linkingAnnotation.body)) {
      for (const body of linkingAnnotation.body) {
        if (
          body.selector?.type === 'PointSelector' &&
          body.selector.x &&
          body.selector.y
        ) {
          coordinates = {
            x: body.selector.x,
            y: body.selector.y,
          };
          console.log(
            `Found coordinates: x=${coordinates.x}, y=${coordinates.y}`,
          );
          break;
        }
      }
    }

    const hasHumanVerification = textRecognitionSources.some(
      (source) => source.isHumanVerified,
    );

    const place: GazetteerPlace = {
      id: linkingAnnotation.id,
      name: completeName,
      category: 'place',
      coordinates: coordinates,
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

      hasPointSelection,
      hasGeotagging,
      hasHumanVerification,
      targetAnnotationCount: linkingAnnotation.target.length,
      mapInfo,
      textRecognitionSources,
    };

    placeMap.set(linkingAnnotation.id, place);
    processedCount++;

    console.log(
      `Created place entry: "${completeName}" with ${textRecognitionSources.length} text sources`,
    );
  }

  console.log(`Successfully processed ${processedCount} linking annotations`);
  console.log(`Fetched ${targetsFetched} target annotations total`);
  console.log(`Skipped ${skippedCount} linking annotations without targets`);
  console.log(`Skipped ${blacklistedSkipped} blacklisted targets`);
  console.log(`Final places: ${placeMap.size}`);

  console.log('Processing geotagged annotations...');
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
        console.log(`Added geotagged place: ${geoPlace.name}`);
      }
    } catch (error) {
      console.error(
        'Error processing geotagged annotation:',
        geoAnnotation.id,
        error,
      );
    }
  }

  console.log(`Final places (including geotagged): ${placeMap.size}`);

  const places = Array.from(placeMap.values());
  console.log(
    'Sample places:',
    places.slice(0, 3).map((p) => ({
      name: p.name,
      category: p.category,
      coordinates: p.coordinates,
      textParts: p.textParts?.length,
      hasPointSelection: p.hasPointSelection,
      hasGeotagging: p.hasGeotagging,
      mapTitle: p.mapInfo?.title,
    })),
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

export function invalidateCache(): void {
  cachedPlaces = null;
  cachedCategories = null;
  cachedGavocData = null;
  cacheTimestamp = 0;
  failedTargetIds.clear();
  blacklistCacheTime = 0;
  console.log('Cache invalidated - next request will fetch fresh data');
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
  console.log('Manually cleared target blacklist');
}

export function getBlacklistedTargets(): string[] {
  return Array.from(failedTargetIds);
}

// Utility function to test different data sources
export async function testDataSources(): Promise<{
  customQuery: { count: number; sample: any[] };
  legacy: { count: number; sample: any[] };
}> {
  console.log('Testing both data sources...');

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

// Function to switch data source (for testing)
export function setDataSource(source: 'custom' | 'legacy'): void {
  // This could be implemented with a flag if needed
  console.log(`Data source set to: ${source}`);
}
