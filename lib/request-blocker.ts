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

  // Check temporary blocks - also check if any parent path is blocked
  const path = getRequestPath(url);
  for (const [blockedPath, blockUntil] of TEMPORARY_BLOCKS.entries()) {
    if (
      Date.now() < blockUntil &&
      (path.includes(blockedPath) || blockedPath.includes(path))
    ) {
      return true;
    }
  }

  // Clean up expired temporary blocks
  const now = Date.now();
  for (const [blockedPath, blockUntil] of Array.from(
    TEMPORARY_BLOCKS.entries(),
  )) {
    if (now >= blockUntil) {
      TEMPORARY_BLOCKS.delete(blockedPath);
    }
  }

  return false;
}

export function unblockRequest(url: string) {
  console.log(`Request blocking disabled for: ${url}`);
  BLOCKED_URLS.delete(url);
  TEMPORARY_BLOCKS.delete(url);
}

// Global emergency state
let EMERGENCY_MODE = false;
let EMERGENCY_START_TIME = 0;

function activateEmergencyMode() {
  if (!EMERGENCY_MODE) {
    EMERGENCY_MODE = true;
    EMERGENCY_START_TIME = Date.now();
    console.log(
      'EMERGENCY MODE ACTIVATED - Stopping all React retry mechanisms',
    );

    // Nuclear option: Clear many timeouts to stop retry loops
    for (let i = 1; i < 10000; i++) {
      clearTimeout(i);
      clearInterval(i);
    }

    // Override setTimeout to prevent new retry loops
    const originalSetTimeout = globalThis.setTimeout;
    (globalThis as any).setTimeout = function (
      callback: any,
      delay: number = 0,
      ...args: any[]
    ) {
      if (EMERGENCY_MODE && delay < 5000) {
        console.log('Emergency mode: Blocking setTimeout with short delay');
        return 0;
      }
      return originalSetTimeout(callback, delay, ...args);
    };
  }
}

export function isEmergencyMode(): boolean {
  // Auto-disable emergency mode after 10 minutes
  if (EMERGENCY_MODE && Date.now() - EMERGENCY_START_TIME > 600000) {
    EMERGENCY_MODE = false;
    console.log('Emergency mode automatically disabled after 10 minutes');
  }
  return EMERGENCY_MODE;
}

export function clearAllBlocks() {
  console.log(`All request blocks cleared`);
  BLOCKED_URLS.clear();
  TEMPORARY_BLOCKS.clear();
  FAILURE_COUNTS.clear();
  REQUEST_TIMESTAMPS.clear();
}

// Track rapid requests and implement intelligent blocking
function trackRequest(url: string) {
  const now = Date.now();
  const path = getRequestPath(url);

  if (!REQUEST_TIMESTAMPS.has(path)) {
    REQUEST_TIMESTAMPS.set(path, []);
  }

  const timestamps = REQUEST_TIMESTAMPS.get(path)!;
  timestamps.push(now);

  // Keep only requests within the window
  const recentRequests = timestamps.filter(
    (time) => now - time < RAPID_REQUEST_WINDOW,
  );
  REQUEST_TIMESTAMPS.set(path, recentRequests);

  // AGGRESSIVE BLOCKING: Check for rapid-fire requests - lower threshold for manifest
  const threshold = path.includes('/api/manifest')
    ? 2
    : RAPID_REQUEST_THRESHOLD;
  if (recentRequests.length >= threshold) {
    console.log(
      `Rapid-fire requests detected for ${path} - applying temporary block`,
    );
    blockRequestTemporarily(path, 60000); // 60 second block for manifest issues
  }
}

function trackFailure(url: string) {
  const path = getRequestPath(url);
  const currentFailures = FAILURE_COUNTS.get(path) || 0;
  FAILURE_COUNTS.set(path, currentFailures + 1);

  // IMMEDIATE BLOCKING for manifest 404s - don't wait for multiple failures
  if (path.includes('/api/manifest') && currentFailures === 0) {
    console.log(
      `Manifest API unavailable - applying immediate block to prevent infinite retries`,
    );
    blockRequestTemporarily(path, 120000); // 2 minute block after first failure
    return;
  }

  // Block after MAX_FAILURES_BEFORE_BLOCK failures for other APIs
  if (currentFailures + 1 >= MAX_FAILURES_BEFORE_BLOCK) {
    console.log(`API unavailable - applying block to prevent infinite retries`);
    blockRequestTemporarily(path, 120000); // 2 minute block after multiple failures
  }
}

function trackSuccess(url: string) {
  const path = getRequestPath(url);
  // Reset failure count on success
  FAILURE_COUNTS.delete(path);
}

function getRequestPath(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return url;
  }
}

function shouldBlockRequest(url: string): boolean {
  const path = getRequestPath(url);

  // EMERGENCY MODE: Block everything
  if (isEmergencyMode()) {
    console.log('Emergency mode active - blocking all requests');
    return true;
  }

  // NUCLEAR OPTION: If manifest API has failed before, block immediately
  if (path.includes('/api/manifest') && FAILURE_COUNTS.has(path)) {
    console.log(`Manifest API previously failed - blocking immediately`);
    blockRequestTemporarily(path, 120000);
    return true;
  }

  // EMERGENCY BRAKE: Block ALL API requests if too many rapid requests detected
  const totalRequests = Array.from(REQUEST_TIMESTAMPS.values()).reduce(
    (total, timestamps) => total + timestamps.length,
    0,
  );

  if (totalRequests > 50) {
    console.log(
      `Emergency brake activated - too many total requests (${totalRequests})`,
    );
    activateEmergencyMode(); // ACTIVATE NUCLEAR OPTION
    blockRequestTemporarily(path, 300000); // 5 minute emergency block
    return true;
  }

  // Track this request
  trackRequest(url);

  // Check if this specific path should be blocked
  return isRequestBlocked(path) || isRequestBlocked(url);
}

function getCurrentBlockDuration(): number {
  return 30000; // Default 30 seconds
}

// Override global fetch to implement blocking
const originalFetch = globalThis.fetch;
globalThis.fetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

  // EMERGENCY DETECTION: Block ALL requests that look like API calls during infinite loops
  const path = getRequestPath(url);
  const isApiCall =
    path.includes('/api/') ||
    path.includes('annotations') ||
    path.includes('manifest');

  if (isApiCall) {
    const now = Date.now();
    const allTimestamps = Array.from(REQUEST_TIMESTAMPS.values()).flat();
    const recentApiCalls = allTimestamps.filter((time) => now - time < 30000); // Last 30 seconds

    if (recentApiCalls.length > 30) {
      console.log(
        `EMERGENCY: Detected infinite API loop (${recentApiCalls.length} calls in 30s) - blocking all API requests`,
      );
      activateEmergencyMode(); // ACTIVATE NUCLEAR OPTION
      blockRequestTemporarily('/api/', 600000); // 10 minute block
      throw new Error(`Emergency block: infinite API loop detected`);
    }
  }

  // Check if request should be blocked
  if (shouldBlockRequest(url)) {
    console.log(
      `Request blocking enabled temporarily for: ${getRequestPath(
        url,
      )} duration: ${getCurrentBlockDuration()}ms`,
    );
    throw new Error(`Request blocked to prevent infinite retries`);
  }

  try {
    const response = await originalFetch(input, init);

    // Track response status for failure counting
    if (!response.ok && response.status >= 400) {
      trackFailure(url);
    } else if (response.ok) {
      trackSuccess(url);
    }

    return response;
  } catch (error) {
    trackFailure(url);
    throw error;
  }
};

// Override XMLHttpRequest for additional protection
const OriginalXMLHttpRequest = globalThis.XMLHttpRequest;
if (OriginalXMLHttpRequest) {
  globalThis.XMLHttpRequest = class extends OriginalXMLHttpRequest {
    open(
      method: string,
      url: string | URL,
      async: boolean = true,
      user?: string | null,
      password?: string | null,
    ) {
      const urlString = typeof url === 'string' ? url : url.toString();

      if (shouldBlockRequest(urlString)) {
        console.log(
          `XMLHttpRequest blocking enabled temporarily for: ${getRequestPath(
            urlString,
          )} duration: ${getCurrentBlockDuration()}ms`,
        );
        throw new Error(`XMLHttpRequest blocked to prevent infinite retries`);
      }

      return super.open(method, url, async, user, password);
    }
  };
}
