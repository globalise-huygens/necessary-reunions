/**
 * Global request blocker to prevent infinite retries
 * This completely blocks requests that have failed with gateway errors
 */

const BLOCKED_URLS = new Set<string>();
const TEMPORARY_BLOCKS = new Map<string, number>();
const FAILURE_COUNTS = new Map<string, number>();
const REQUEST_TIMESTAMPS = new Map<string, number[]>(); // Track rapid requests
const PERMANENT_BLOCK_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_FAILURES_BEFORE_BLOCK = 3; // Allow 3 failures before blocking
const RAPID_REQUEST_THRESHOLD = 5; // 5 requests
const RAPID_REQUEST_WINDOW = 10000; // within 10 seconds = rapid fire

export function blockRequestPermanently(url: string) {
  console.log(`Request blocking enabled permanently for: ${url}`);
  BLOCKED_URLS.add(url);

  // Also set a temporary block that will clear automatically
  TEMPORARY_BLOCKS.set(url, Date.now() + PERMANENT_BLOCK_DURATION);
}

export function blockRequestTemporarily(
  url: string,
  durationMs: number = 30000,
) {
  console.log(
    `Request blocking enabled temporarily for: ${url} duration: ${durationMs}ms`,
  );
  TEMPORARY_BLOCKS.set(url, Date.now() + durationMs);
}

export function isRequestBlocked(url: string): boolean {
  // Check permanent blocks
  if (BLOCKED_URLS.has(url)) {
    return true;
  }

  // Check temporary blocks
  const blockUntil = TEMPORARY_BLOCKS.get(url);
  if (blockUntil && Date.now() < blockUntil) {
    return true;
  }

  // Clean up expired temporary blocks
  if (blockUntil && Date.now() >= blockUntil) {
    TEMPORARY_BLOCKS.delete(url);
  }

  return false;
}

export function unblockRequest(url: string) {
  console.log(`Request blocking disabled for: ${url}`);
  BLOCKED_URLS.delete(url);
  TEMPORARY_BLOCKS.delete(url);
}

export function clearAllBlocks() {
  console.log(`All request blocks cleared`);
  BLOCKED_URLS.clear();
  TEMPORARY_BLOCKS.clear();
  FAILURE_COUNTS.clear();
  REQUEST_TIMESTAMPS.clear();
}

// Intercept fetch to prevent blocked requests (browser only)
if (typeof window !== 'undefined') {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    // Only check blocking for our specific API endpoints
    const isOurAPI =
      url.includes('/api/annotations/') || url.includes('/api/manifest');

    if (isOurAPI) {
      // Track request timestamps to detect rapid-fire requests
      const now = Date.now();
      const timestamps = REQUEST_TIMESTAMPS.get(url) || [];

      // Remove old timestamps outside the window
      const recentTimestamps = timestamps.filter(
        (timestamp) => now - timestamp < RAPID_REQUEST_WINDOW,
      );
      recentTimestamps.push(now);
      REQUEST_TIMESTAMPS.set(url, recentTimestamps);

      // Block immediately if too many requests in short time
      if (recentTimestamps.length >= RAPID_REQUEST_THRESHOLD) {
        console.warn(
          `Rapid request pattern detected: ${recentTimestamps.length} requests to ${url} within ${RAPID_REQUEST_WINDOW}ms - applying emergency block`,
        );
        blockRequestTemporarily(url, 60000); // 1 minute emergency block
      }
    }

    // Check if this request should be blocked
    if (isOurAPI && isRequestBlocked(url)) {
      console.warn(`Request blocked: ${url}`);

      // Return appropriate fake response based on endpoint
      if (url.includes('/api/manifest')) {
        return new Response(
          JSON.stringify({
            '@context': 'http://iiif.io/api/presentation/3/context.json',
            id: 'https://example.org/manifest',
            type: 'Manifest',
            label: { en: ['API Temporarily Unavailable'] },
            items: [],
          }),
          {
            status: 200,
            statusText: 'OK (Blocked)',
            headers: { 'Content-Type': 'application/json' },
          },
        );
      } else {
        return new Response(
          JSON.stringify({
            annotations: [],
            iconStates: {},
            blocked: true,
            message: 'Request blocked due to rapid requests or failures',
          }),
          {
            status: 200,
            statusText: 'OK (Blocked)',
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }

    try {
      const response = await originalFetch(input, init);

      // Reset failure count on successful response
      if (isOurAPI && response.ok) {
        FAILURE_COUNTS.delete(url);
      }

      // Only temporarily block our API endpoints after multiple gateway errors
      if (isOurAPI && (response.status === 502 || response.status === 504)) {
        const currentFailures = (FAILURE_COUNTS.get(url) || 0) + 1;
        FAILURE_COUNTS.set(url, currentFailures);

        console.log(
          `API failure ${currentFailures}/${MAX_FAILURES_BEFORE_BLOCK} for ${url}`,
        );

        if (currentFailures >= MAX_FAILURES_BEFORE_BLOCK) {
          blockRequestTemporarily(url, 60000); // 1 minute temporary block only
          FAILURE_COUNTS.delete(url); // Reset count after blocking
        }
      }

      // Special handling for manifest 404s - these cause infinite IIIF viewer retries
      // Block IMMEDIATELY on any manifest error to prevent loops
      if (url.includes('/api/manifest') && response.status === 404) {
        console.warn(
          'Manifest API unavailable - applying block to prevent infinite retries',
        );
        blockRequestTemporarily(url, 120000); // 2 minute block to allow deployment
        return new Response(
          JSON.stringify({
            '@context': 'http://iiif.io/api/presentation/3/context.json',
            id: 'https://example.org/manifest',
            type: 'Manifest',
            label: { en: ['Fallback Manifest - API Unavailable'] },
            items: [],
          }),
          {
            status: 200,
            statusText: 'OK (Fallback)',
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      return response;
    } catch (error) {
      // Only block our API endpoints on network errors after multiple failures
      if (
        isOurAPI &&
        error instanceof Error &&
        (error.name === 'AbortError' ||
          error.message.includes('timeout') ||
          error.message.includes('fetch'))
      ) {
        const currentFailures = (FAILURE_COUNTS.get(url) || 0) + 1;
        FAILURE_COUNTS.set(url, currentFailures);

        console.log(
          `Network error ${currentFailures}/${MAX_FAILURES_BEFORE_BLOCK} for ${url}`,
        );

        if (currentFailures >= MAX_FAILURES_BEFORE_BLOCK) {
          blockRequestTemporarily(url, 30000); // 30 second block for network errors
          FAILURE_COUNTS.delete(url); // Reset count after blocking
        }
      }
      throw error;
    }
  };
}
