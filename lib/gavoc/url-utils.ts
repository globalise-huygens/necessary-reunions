import { parseLocationPath } from './data-processing';
import { GavocLocation } from './types';

/**
 * Find a location by ID
 */
export function findLocationById(
  locations: GavocLocation[],
  id: string,
): GavocLocation | null {
  return (
    locations.find(
      (location) => location.id === `gavoc-${id}` || location.indexPage === id,
    ) || null
  );
}

/**
 * Find a location by URL path
 */
export function findLocationByPath(
  locations: GavocLocation[],
  path: string,
): GavocLocation | null {
  const parsed = parseLocationPath(path);
  if (!parsed) return null;

  return findLocationById(locations, parsed.id);
}

/**
 * Get the current location from URL
 */
export function getCurrentLocationFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  const parsed = parseLocationPath(window.location.pathname);
  return parsed?.id || null;
}

/**
 * Update the URL to reflect the selected location
 */
export function updateUrlForLocation(
  location: GavocLocation | null,
  replace: boolean = false,
): void {
  if (typeof window === 'undefined') return;

  const baseUrl = '/gavoc';
  const newUrl = location ? location.urlPath || baseUrl : baseUrl;

  if (replace) {
    window.history.replaceState({}, '', newUrl);
  } else {
    window.history.pushState({}, '', newUrl);
  }
}

/**
 * Generate a shareable URL for a location
 */
export function getShareableUrl(location: GavocLocation): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${location.urlPath}`;
  }
  return location.uri || '';
}
