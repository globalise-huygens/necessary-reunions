// @ts-nocheck
/* eslint-disable */
import type {
  GazetteerFilter,
  GazetteerPlace,
  GazetteerSearchResult,
  PlaceCategory,
} from './types';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

const CACHE_DURATION = 60 * 60 * 1000;
const MAX_PAGES_PER_REQUEST = 10; // Fetch all linking annotation pages (~7 pages exist)
const REQUEST_TIMEOUT = 2000; // 2s timeout - must be less than QUICK_TIMEOUT
const MAX_LINKING_ANNOTATIONS = 500; // Process up to 500 annotations (5 pages)
const MAX_TARGET_FETCHES = 500; // Increased from 100 - allow fetching more target annotations
const MAX_CONCURRENT_REQUESTS = 3; // Reasonable concurrency
const PROCESSING_TIME_LIMIT = 9000; // 9 seconds total - use most of the 10s Netlify limit

const COORDINATE_PRECISION = 4;

// Circuit breaker and external fetch functions
// CURRENTLY DISABLED - using static GAVOC data only to avoid 504 timeouts
// Uncomment and re-enable if you want to fetch from AnnoRepo

/* DISABLED - AnnoRepo fetching code
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_TIME = 60 * 1000;

function shouldSkipAnnoRepo(): boolean {
  const now = Date.now();

  // Circuit is open - check if enough time has passed to try again
  if (annoRepoCircuitOpen) {
    if (now - annoRepoCircuitOpenTime > CIRCUIT_BREAKER_RESET_TIME) {
      // Try half-open state
      console.log('[Circuit Breaker] Attempting to close circuit...');
      annoRepoCircuitOpen = false;
      annoRepoFailureCount = 0;
      return false;
    }
    console.log('[Circuit Breaker] Circuit open - skipping AnnoRepo');
    return true;
  }

  return false;
}

function recordAnnoRepoSuccess(): void {
  annoRepoFailureCount = 0;
  annoRepoCircuitOpen = false;
  console.log('[Circuit Breaker] AnnoRepo successful - reset counter');
}

function recordAnnoRepoFailure(): void {
  annoRepoFailureCount++;
  console.log(
    `[Circuit Breaker] AnnoRepo failure ${annoRepoFailureCount}/${CIRCUIT_BREAKER_THRESHOLD}`,
  );

  if (annoRepoFailureCount >= CIRCUIT_BREAKER_THRESHOLD) {
    annoRepoCircuitOpen = true;
    annoRepoCircuitOpenTime = Date.now();
    console.log('[Circuit Breaker] Opening circuit - too many failures');
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/return-await */

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
    const currentPage = page;

    while (retries < maxRetries && !success) {
      const currentRetries = retries;
      try {
        const result = await throttleRequest(async () => {
          const customQueryUrl =
            currentPage === 0
              ? `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=Z2VvdGFnZ2luZw==`
              : `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=Z2VvdGFnZ2luZw==?page=${currentPage}`;

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

          return await response.json();
        });

        if (result.items && Array.isArray(result.items)) {
          allAnnotations.push(...result.items);
        }

        hasMore = !!result.next;
        success = true;
        page++;
        pagesProcessed++;

        // Add small delay between pages to avoid overwhelming the server
        if (hasMore && pagesProcessed < MAX_PAGES_PER_REQUEST) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 100);
          });
        }
      } catch (error) {
        retries++;
        console.warn(
          `[Gazetteer] Failed to fetch geotagging page ${currentPage}, retry ${retries}/${maxRetries}:`,
          error instanceof Error ? error.message : 'Unknown error',
        );
        if (retries >= maxRetries) {
          hasMore = false;
        } else {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 500 * currentRetries);
          });
        }
      }
    }
  }

  console.log(
    `[Gazetteer] Fetched ${allAnnotations.length} geotagging annotations from ${pagesProcessed} pages`,
  );
  return allAnnotations;
}

let cachedPlaces: GazetteerPlace[] | null = null;
let cachedCategories: PlaceCategory[] | null = null;
let cachedGavocData: any[] | null = null;
let cacheTimestamp: number = 0;
let cachedMetadata: {
  totalAnnotations: number;
  processedAnnotations: number;
  truncated: boolean;
  warning?: string;
} | null = null;

// Background fetch state
let backgroundFetchInProgress = false;
let backgroundFetchPromise: Promise<void> | null = null;

const failedTargetIds = new Set<string>();
let blacklistCacheTime = 0;
const BLACKLIST_CACHE_DURATION = 60 * 60 * 1000;

let activeRequests = 0;
const requestQueue: (() => Promise<void>)[] = [];

async function throttleRequest<T>(requestFn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const executeRequest = async (): Promise<void> => {
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
            void setTimeout(() => {
              nextRequest().catch(() => {});
            }, 100);
          }
        }
      }
    };

    executeRequest().catch(() => {});
  });
}

async function getAllProcessedPlaces(): Promise<GazetteerPlace[]> {
  const now = Date.now();

  console.log(
    `[Gazetteer] getAllProcessedPlaces called - cache state: ${cachedPlaces ? `${cachedPlaces.length} places` : 'NULL'}, age: ${cacheTimestamp ? Math.round((now - cacheTimestamp) / 1000) + 's' : 'N/A'}`,
  );

  // Return cached data if available and fresh (1 hour TTL)
  if (cachedPlaces && now - cacheTimestamp < CACHE_DURATION) {
    console.log(
      `[Gazetteer] Returning cached data (age: ${Math.round((now - cacheTimestamp) / 1000)}s, ${cachedPlaces.length} places)`,
    );

    // Trigger background refresh if cache is getting old (> 50 minutes)
    if (now - cacheTimestamp > 50 * 60 * 1000 && !backgroundFetchInProgress) {
      console.log(
        '[Gazetteer] Cache getting old - triggering background refresh',
      );
      void triggerBackgroundFetch();
    }

    return cachedPlaces;
  }

  // If cache is stale but background fetch in progress, return stale cache
  if (cachedPlaces && backgroundFetchInProgress) {
    console.log(
      '[Gazetteer] Background refresh in progress, returning stale cache',
    );
    return cachedPlaces;
  }

  // Strategy: Quick initial fetch (2 pages) then expand in background
  // This ensures first request succeeds within Netlify timeout
  console.log(
    '[Gazetteer] Fetching initial data from AnnoRepo (quick mode)...',
  );

  try {
    // Quick fetch: Just 2 pages to stay well under timeout
    const result = await fetchQuickInitial();

    if (result.places.length > 0) {
      // Cache the initial data
      cachedPlaces = result.places;
      cachedMetadata = {
        totalAnnotations: result.totalAnnotations,
        processedAnnotations: result.processedAnnotations,
        truncated: true, // Mark as partial
        warning: 'Initial load - fetching more in background',
      };
      cacheTimestamp = now;
      console.log(
        `[Gazetteer] ✓ Cached ${result.places.length} places (initial)`,
      );

      // Trigger background fetch for remaining data
      void triggerBackgroundFetch();

      return cachedPlaces;
    }

    console.error(
      `[Gazetteer] ERROR: fetchQuickInitial returned 0 places but ${result.totalAnnotations} total annotations`,
    );
    throw new Error('No places returned from quick fetch');
  } catch (error) {
    console.error('[Gazetteer] Quick fetch failed:', error);

    // If we have stale cache, return it with a warning
    if (cachedPlaces && cachedPlaces.length > 0) {
      console.log('[Gazetteer] Returning stale cached data as fallback');
      if (cachedMetadata) {
        cachedMetadata.warning = 'Using cached data - refresh failed';
      }
      return cachedPlaces;
    }

    // No cache and fetch failed - return empty
    console.log('[Gazetteer] No cache available and fetch failed');
    return [];
  }
}

/**
 * Quick initial fetch - just 1-2 pages to stay under timeout
 * OPTIMIZED: Reduced from 2 pages to ensure fast response
 */
async function fetchQuickInitial(): Promise<{
  places: GazetteerPlace[];
  totalAnnotations: number;
  processedAnnotations: number;
  truncated: boolean;
  warning?: string;
}> {
  const functionStartTime = Date.now();
  const QUICK_TIMEOUT = 12000; // 12s for processing - must be > PROCESSING_TIME_LIMIT

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Quick fetch timeout')), QUICK_TIMEOUT);
  });

  const fetchPromise = (async () => {
    // Fetch 5 pages to match local development (500 annotations)
    const linkingAnnotations = await fetchLinkingAnnotationsPaginated(5);

    console.log(
      `[Gazetteer] Quick fetch: ${linkingAnnotations.length} annotations in ${Date.now() - functionStartTime}ms`,
    );

    if (linkingAnnotations.length === 0) {
      console.error('[Gazetteer] ERROR: No linking annotations fetched!');
      throw new Error('No linking annotations fetched');
    }

    console.log('[Gazetteer] Starting processPlaceData...');

    // Process annotations to extract place data
    const allAnnotations = { linking: linkingAnnotations, geotagging: [] };
    const result = await processPlaceData(allAnnotations);

    console.log(
      `[Gazetteer] processPlaceData returned ${result.places.length} places`,
    );

    return {
      ...result,
      truncated: true,
      warning: 'Initial load - more data loading in background',
    };
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

/**
 * Background fetch to get all remaining data
 * OPTIMIZED: Fetch up to 5 pages (reduced from 10) for better performance
 */
async function triggerBackgroundFetch(): Promise<void> {
  if (backgroundFetchInProgress) {
    console.log('[Gazetteer] Background fetch already in progress');
    return;
  }

  backgroundFetchInProgress = true;
  console.log('[Gazetteer] Starting background fetch for complete dataset...');

  try {
    // Fetch up to 5 pages (reduced from 10 for faster completion)
    const linkingAnnotations = await fetchLinkingAnnotationsPaginated(5);

    console.log(
      `[Gazetteer] Background fetch complete: ${linkingAnnotations.length} annotations`,
    );

    if (linkingAnnotations.length > 0) {
      // Process all annotations
      const allAnnotations = { linking: linkingAnnotations, geotagging: [] };
      const result = await processPlaceData(allAnnotations);

      // Update cache with complete dataset
      cachedPlaces = result.places;
      cachedMetadata = {
        totalAnnotations: result.totalAnnotations,
        processedAnnotations: result.processedAnnotations,
        truncated: false,
        warning: undefined,
      };
      cacheTimestamp = Date.now();

      console.log(
        `[Gazetteer] ✓ Background fetch complete - cached ${result.places.length} places`,
      );
    }
  } catch (error) {
    console.error('[Gazetteer] Background fetch failed:', error);
  } finally {
    backgroundFetchInProgress = false;
  }
}

/**
 * Fetch linking annotations with configurable page limit
 * OPTIMIZED: Fetch only what's needed within timeout constraints
 */
async function fetchLinkingAnnotationsPaginated(
  maxPages: number,
): Promise<any[]> {
  const allAnnotations: any[] = [];
  let page = 0;
  let hasMore = true;
  const maxRetries = 1; // Reduced from 2 for faster failure
  let pagesProcessed = 0;
  const startTime = Date.now();
  const MAX_FETCH_TIME = maxPages <= 2 ? 5000 : 7000; // Adaptive timeout

  while (hasMore && pagesProcessed < maxPages) {
    // Check if we're running out of time
    if (Date.now() - startTime > MAX_FETCH_TIME) {
      console.log(
        `[Gazetteer] Time limit reached after ${pagesProcessed} pages, stopping pagination`,
      );
      break;
    }

    let retries = 0;
    let success = false;
    const currentPage = page;

    while (retries < maxRetries && !success) {
      try {
        const customQueryUrl =
          currentPage === 0
            ? `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==`
            : `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==?page=${currentPage}`;

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

        const result = await response.json();

        if (result.items && Array.isArray(result.items)) {
          allAnnotations.push(...result.items);
          console.log(
            `[Gazetteer] Page ${currentPage}: +${result.items.length} annotations (total: ${allAnnotations.length})`,
          );
        }

        hasMore = !!result.next;
        success = true;
        page++;
        pagesProcessed++;

        if (!hasMore) {
          console.log(`[Gazetteer] Reached last page at ${currentPage}`);
        }

        // No delay for first 2 pages (speed up initial load)
        if (hasMore && pagesProcessed < maxPages && pagesProcessed >= 2) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 50); // Reduced from 100ms
          });
        }
      } catch (error) {
        retries++;
        console.warn(
          `[Gazetteer] Failed to fetch page ${currentPage}, retry ${retries}/${maxRetries}:`,
          error instanceof Error ? error.message : 'Unknown error',
        );
        if (retries >= maxRetries) {
          console.warn(
            `[Gazetteer] Skipping page ${currentPage} after ${maxRetries} failed retries`,
          );
          // Don't increment page on failure - just stop trying this page
          hasMore = false;
          break;
        }
      }
    }
  }

  console.log(
    `[Gazetteer] Fetched ${allAnnotations.length} linking annotations from ${pagesProcessed} pages in ${Date.now() - startTime}ms`,
  );
  return allAnnotations;
}

/**
 * Fetch data with timeout protection
 * Tries to get all data but will return partial if time runs out
 */
async function fetchWithTimeout(): Promise<{
  places: GazetteerPlace[];
  totalAnnotations: number;
  processedAnnotations: number;
  truncated: boolean;
  warning?: string;
}> {
  const functionStartTime = Date.now();
  const TOTAL_TIMEOUT = 8000; // 8s to stay within Netlify limits with overhead

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Overall fetch timeout')), TOTAL_TIMEOUT);
  });

  const fetchPromise = (async () => {
    const linkingAnnotations = await fetchLinkingAnnotationsFromCustomQuery();

    console.log(
      `[Gazetteer] Fetched ${linkingAnnotations.length} linking annotations in ${Date.now() - functionStartTime}ms`,
    );

    if (linkingAnnotations.length === 0) {
      throw new Error('No linking annotations fetched');
    }

    // Process annotations to extract place data
    const allAnnotations = { linking: linkingAnnotations, geotagging: [] };
    const result = await processPlaceData(allAnnotations);

    return result;
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

/**
 * Load GAVOC CSV as fallback
 */
async function loadGavocFallback(): Promise<GazetteerPlace[]> {
  const gavocData = await getCachedGavocData();

  const fallbackPlaces: GazetteerPlace[] = gavocData.map((item) => ({
    id: `gavoc-${item['Oorspr. naam op de kaart/Original name on the map'] || 'unknown'}`,
    name:
      item['Oorspr. naam op de kaart/Original name on the map'] || 'Unknown',
    modernName: item['Hedendaagse naam/Modern name'] || undefined,
    alternativeNames: [],
    category: item.category || 'plaats',
    coordinates: item.coordinates || undefined,
    source: 'gavoc-fallback' as const,
  }));

  cachedPlaces = fallbackPlaces;
  cachedMetadata = {
    totalAnnotations: gavocData.length,
    processedAnnotations: fallbackPlaces.length,
    truncated: false,
    warning: 'Using fallback GAVOC CSV data - AnnoRepo unavailable',
  };
  cacheTimestamp = Date.now();

  return cachedPlaces;
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
      warning: cachedMetadata?.warning,
      truncated: cachedMetadata?.truncated,
      processedAnnotations: cachedMetadata?.processedAnnotations,
      availableAnnotations: cachedMetadata?.totalAnnotations,
    };
  } catch (error) {
    console.error('[Gazetteer] fetchAllPlaces error:', error);
    return {
      places: [],
      totalCount: 0,
      hasMore: false,
      _error: error instanceof Error ? error.message : String(error),
      _errorStack:
        error instanceof Error
          ? error.stack?.split('\n').slice(0, 5).join('|')
          : undefined,
    } as any;
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
  } catch {
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
  } catch {
    return cachedCategories || [];
  }
}

async function fetchGavocAtlasData(): Promise<any[]> {
  try {
    // CRITICAL: Edge runtime can't fetch from relative URLs or access filesystem
    // GAVOC data is only used as fallback when AnnoRepo fails
    // Skip this in Edge runtime to avoid hanging

    // Check if we're in Edge runtime (no process.env in Edge)
    if (typeof process === 'undefined' || !process.env) {
      console.log('[Gazetteer] Skipping GAVOC fetch in Edge runtime');
      return [];
    }

    // For now, skip GAVOC fetching entirely as it causes hangs in Edge runtime
    // The data is only fallback anyway and AnnoRepo should be the primary source
    console.log(
      '[Gazetteer] GAVOC fallback disabled for Edge runtime compatibility',
    );
    return [];
  } catch (error) {
    console.error('[Gazetteer] Error fetching GAVOC data:', error);
    return [];
  }
}

function parseGavocCSV(csvText: string): Array<Record<string, any>> {
  const lines = csvText.split('\n');
  if (lines.length === 0) return [];
  const headers = lines[0]?.split(',') ?? [];

  return lines
    .slice(1)
    .map((line) => {
      const values = parseCSVLine(line);
      if (values.length < headers.length) return null;

      const item: Record<string, any> = {};
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
    .filter(Boolean) as Array<Record<string, any>>;
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
  if (!latDeg || !latMin || !lngDeg || !lngMin) return null;

  let lat = parseInt(latDeg, 10) + parseInt(latMin, 10) / 60;
  let lng = parseInt(lngDeg, 10) + parseInt(lngMin, 10) / 60;

  if (latDir === 'S') lat = -lat;
  if (lngDir === 'W') lng = -lng;

  return { lat, lng };
}

async function fetchTargetAnnotation(targetId: string): Promise<any> {
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
      console.log(
        `[Gazetteer] fetchTargetAnnotation failed: ${response.status} for ${targetId.slice(-12)}`,
      );
      if (response.status === 404) {
        failedTargetIds.add(targetId);
        blacklistCacheTime = Date.now();
      }
      return null;
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.log(
      `[Gazetteer] fetchTargetAnnotation error: ${(error as Error).name} for ${targetId.slice(-12)}`,
    );
    return null;
  }
}

async function fetchMapMetadata(manifestUrl: string): Promise<any | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(manifestUrl, {
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export async function processPlaceData(annotationsData: {
  linking: any[];
  geotagging: any[];
}): Promise<{
  places: GazetteerPlace[];
  totalAnnotations: number;
  processedAnnotations: number;
  truncated: boolean;
  warning?: string;
}> {
  console.log(
    `[Gazetteer] processPlaceData called with ${annotationsData.linking.length} linking annotations`,
  );

  const placeMap = new Map<string, GazetteerPlace>();

  let processedCount = 0;
  let targetsFetched = 0;
  let blacklistedSkipped = 0;

  const processingStartTime = Date.now();
  const totalLinkingAnnotations = annotationsData.linking.length;

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

  console.log(
    `[Gazetteer] Split annotations: ${geotaggedLinkingAnnotations.length} geotagged, ${textLinkingAnnotations.length} text-only (out of ${limitedLinkingAnnotations.length} total)`,
  );

  if (limitedLinkingAnnotations.length === 0) {
    console.error('[Gazetteer] ERROR: No linking annotations to process!');
    return {
      places: [],
      totalAnnotations: annotationsData.linking.length,
      processedAnnotations: 0,
      truncated: false,
      warning: 'No annotations to process',
    };
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
          /POINT\(([^\s]+)\s+([^)]+)\)/,
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
    } catch {}
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

      if (geoSource.category) {
        placeCategory = geoSource.category.split('/')[0];
      } else if (geoSource.properties?.category) {
        placeCategory = geoSource.properties.category.split('/')[0];
      } else if (identifyingBody?.source?.category) {
        placeCategory = identifyingBody.source.category.split('/')[0];
      }

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
          /POINT\(([^\s]+)\s+([^)]+)\)/,
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
          } catch {}
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
            } catch {}
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
      }
    } catch {}
  }

  for (const linkingAnnotation of textLinkingAnnotations) {
    processedCount++;

    const elapsedTime = Date.now() - processingStartTime;
    if (elapsedTime > PROCESSING_TIME_LIMIT) {
      console.log(
        `[Gazetteer] Hit processing time limit after ${processedCount} annotations`,
      );
      break;
    }

    if (!linkingAnnotation.target || !Array.isArray(linkingAnnotation.target)) {
      console.log(
        `[Gazetteer] Skipping annotation ${processedCount}: no valid targets`,
      );
      continue;
    }

    // Validate that targets are valid URLs or objects with valid IDs
    const validTargets = linkingAnnotation.target.filter((target: any) => {
      if (typeof target === 'string') {
        try {
          new URL(target);
          return true;
        } catch {
          return false;
        }
      } else if (target && (target.source || target.id)) {
        const targetUrl = target.source || target.id;
        try {
          new URL(targetUrl);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    });

    if (validTargets.length === 0) {
      console.log(
        `[Gazetteer] Skipping annotation ${processedCount}: no valid target URLs`,
      );
      continue;
    }

    // Update the target array to only include valid targets
    linkingAnnotation.target = validTargets;

    if (targetsFetched >= MAX_TARGET_FETCHES) {
      console.log(
        `[Gazetteer] Reached MAX_TARGET_FETCHES limit: ${MAX_TARGET_FETCHES}`,
      );
      break;
    }

    if (processedCount % 100 === 0 && processedCount > 0) {
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
        geoSource.preferredTerm ||
        geoSource.label ||
        geoSource.properties?.title ||
        geoSource.properties?.name ||
        geoSource.properties?.display_name ||
        'Unknown Place';

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

    // Prepare target IDs for batch fetching
    const targetIdsToFetch: Array<{ id: string; url: string }> = [];
    for (let i = 0; i < linkingAnnotation.target.length; i++) {
      if (targetsFetched + targetIdsToFetch.length >= MAX_TARGET_FETCHES) {
        console.log(
          `[Gazetteer] Hit MAX_TARGET_FETCHES limit: ${MAX_TARGET_FETCHES}`,
        );
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
        continue;
      }

      targetIdsToFetch.push({ id: targetId, url: targetUrl });
    }

    // Fetch targets in parallel batches of 10 for 5-10x performance improvement
    const BATCH_SIZE = 10;
    for (
      let batchStart = 0;
      batchStart < targetIdsToFetch.length;
      batchStart += BATCH_SIZE
    ) {
      const batchTargets = targetIdsToFetch.slice(
        batchStart,
        batchStart + BATCH_SIZE,
      );
      const batchResults = await Promise.all(
        batchTargets.map((t) => fetchTargetAnnotation(t.id)),
      );

      console.log(
        `[Gazetteer] Batch fetch completed: ${batchResults.filter((r) => r !== null).length}/${batchResults.length} successful`,
      );

      // Process each batch result with its corresponding target ID
      for (let i = 0; i < batchResults.length; i++) {
        const targetAnnotation = batchResults[i];
        const targetId = batchTargets[i]?.id;
        if (!targetId) continue;
        targetsFetched++;

        if (!targetAnnotation) {
          console.log(
            `[Gazetteer] Target ${targetId.slice(-8)} fetch failed (null)`,
          );
          continue;
        }

        if (targetAnnotation.motivation !== 'textspotting') {
          console.log(
            `[Gazetteer] Target ${targetId.slice(-8)} skipped (not textspotting: ${targetAnnotation.motivation})`,
          );
          continue;
        }

        allTargetsFailed = false;
        console.log(
          `[Gazetteer] Target ${targetId.slice(-8)} processed successfully`,
        );

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
            } catch {}
          }
        }
      } // End of batch results processing
    } // End of batch fetching loop

    if (
      allTargetsFailed &&
      textRecognitionSources.length === 0 &&
      !geotaggingBody
    ) {
      console.log(
        `[Gazetteer] Skipping annotation: allTargetsFailed=${allTargetsFailed}, textRecognitionSources=${textRecognitionSources.length}`,
      );
      continue;
    }

    console.log(
      `[Gazetteer] Processing annotation into place: textRecognitionSources=${textRecognitionSources.length}`,
    );

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

      for (const texts of textsByTarget.values()) {
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
        const geoPlaceName = geoAnnotation.body.value;
        const geoKey = `geo_${geoAnnotation.id}`;

        let existingPlace: GazetteerPlace | undefined;
        for (const place of placeMap.values()) {
          if (
            place.name === geoPlaceName ||
            place.alternativeNames?.includes(geoPlaceName)
          ) {
            existingPlace = place;
            break;
          }
        }

        if (existingPlace) {
          existingPlace.isGeotagged = true;
          existingPlace.hasGeotagging = true;
          existingPlace.coordinates =
            geoAnnotation.body.latitude && geoAnnotation.body.longitude
              ? {
                  x: geoAnnotation.body.longitude,
                  y: geoAnnotation.body.latitude,
                }
              : existingPlace.coordinates;
          existingPlace.coordinateType = 'geographic';

          if (!existingPlace.annotations) {
            existingPlace.annotations = [];
          }
          existingPlace.annotations.push(geoAnnotation.id);
        } else {
          const geoPlace: GazetteerPlace = {
            id: geoAnnotation.id,
            name: geoPlaceName,
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
            textRecognitionSources: [],
          };

          placeMap.set(geoKey, geoPlace);
        }
      }
    } catch {}
  }

  console.log(
    `[Gazetteer] placeMap size: ${placeMap.size} places after processing all annotations`,
  );
  console.log(
    `[Gazetteer] Processing stats: ${processedCount} processed, ${targetsFetched} targets fetched, ${blacklistedSkipped} blacklisted`,
  );

  const places = Array.from(placeMap.values());

  // Count places by source
  const geotaggedPlaces = places.filter((p) => p.isGeotagged).length;
  const textPlaces = places.length - geotaggedPlaces;

  const actualProcessed = limitedLinkingAnnotations.length;
  const truncated = totalLinkingAnnotations > MAX_LINKING_ANNOTATIONS;
  let warning: string | undefined;

  if (truncated) {
    warning = `Data limited: processed ${actualProcessed} of ${totalLinkingAnnotations} available annotations due to serverless timeout constraints. Some places may be missing.`;
  }

  console.log(
    `[Gazetteer] Processed ${places.length} unique places from annotations`,
  );
  console.log(
    `[Gazetteer] Places by source: ${geotaggedPlaces} from geotagging, ${textPlaces} from text annotations`,
  );
  console.log(
    `[Gazetteer] Stats: ${processedCount} linking annotations processed, ${targetsFetched} targets fetched, ${blacklistedSkipped} blacklisted skipped`,
  );

  return {
    places,
    totalAnnotations: totalLinkingAnnotations,
    processedAnnotations: actualProcessed,
    truncated,
    warning,
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
  cachedMetadata = null;
  cacheTimestamp = 0;
  failedTargetIds.clear();
  blacklistCacheTime = 0;
}

// Cache is now lazily initialized on first request, not invalidated at module load
// This prevents race conditions and duplicate fetches in serverless environment

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

export function getCacheInfo(): {
  cached: boolean;
  cacheAge: number;
  totalPlaces: number;
} {
  const now = Date.now();
  const age = cacheTimestamp > 0 ? now - cacheTimestamp : 0;
  return {
    cached: !!cachedPlaces && age < CACHE_DURATION,
    cacheAge: Math.round(age / 1000), // age in seconds
    totalPlaces: cachedPlaces?.length || 0,
  };
}
