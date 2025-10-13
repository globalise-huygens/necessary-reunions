/**
 * DISABLED request blocker - let the site work normally
 * The infinite loops are a React hydration issue that can't be stopped client-side
 */

// EMERGENCY: Completely disable all blocking to allow the site to function
export function blockRequestPermanently(url: string) {
  // Disabled - no longer blocking
}

export function blockRequestTemporarily(
  url: string,
  durationMs: number = 30000,
) {
  // Disabled - no longer blocking
}

export function isRequestBlocked(url: string): boolean {
  // Always return false - never block anything
  return false;
}

export function unblockRequest(url: string) {
  // Request unblocking confirmed
}

export function isEmergencyMode(): boolean {
  // Always disabled
  return false;
}

export function clearAllBlocks() {
  // All blocking systems disabled
}

// COMPLETELY DISABLED fetch override - use original fetch
const originalFetch = globalThis.fetch;
