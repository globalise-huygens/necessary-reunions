/**
 * Global request blocker to prevent infinite retries
 * This completely blocks requests that have failed with gateway errors
 */

const BLOCKED_URLS = new Set<string>();
const TEMPORARY_BLOCKS = new Map<string, number>();
const PERMANENT_BLOCK_DURATION = 5 * 60 * 1000; // 5 minutes

export function blockRequestPermanently(url: string) {
  console.log(`🚫 Permanently blocking requests to: ${url}`);
  BLOCKED_URLS.add(url);

  // Also set a temporary block that will clear automatically
  TEMPORARY_BLOCKS.set(url, Date.now() + PERMANENT_BLOCK_DURATION);
}

export function blockRequestTemporarily(
  url: string,
  durationMs: number = 30000,
) {
  console.log(
    `⏱️ Temporarily blocking requests to: ${url} for ${durationMs}ms`,
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
  console.log(`✅ Unblocking requests to: ${url}`);
  BLOCKED_URLS.delete(url);
  TEMPORARY_BLOCKS.delete(url);
}

export function clearAllBlocks() {
  console.log(`🔄 Clearing all request blocks`);
  BLOCKED_URLS.clear();
  TEMPORARY_BLOCKS.clear();
}

// Intercept fetch to prevent blocked requests (browser only)
if (typeof window !== 'undefined') {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    // Check if this request should be blocked
    if (isRequestBlocked(url)) {
      console.warn(`🚫 Blocked fetch request to: ${url}`);

      // Return a fake successful response to prevent React retries
      return new Response(
        JSON.stringify({
          annotations: [],
          iconStates: {},
          blocked: true,
          message: 'Request blocked due to previous failures',
        }),
        {
          status: 200,
          statusText: 'OK (Blocked)',
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    try {
      const response = await originalFetch(input, init);

      // Block future requests if this one fails with gateway errors
      if (response.status === 502 || response.status === 504) {
        blockRequestPermanently(url);
      }

      return response;
    } catch (error) {
      // Block on network errors too
      if (
        error instanceof Error &&
        (error.name === 'AbortError' ||
          error.message.includes('timeout') ||
          error.message.includes('fetch'))
      ) {
        blockRequestTemporarily(url, 60000); // 1 minute block for network errors
      }
      throw error;
    }
  };
}
