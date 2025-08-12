import { parseLocationPath } from './data-processing';
import { GavocThesaurusEntry } from './thesaurus';
import { GavocLocation } from './types';

/**
 * Parse a concept URL path to extract slug and coordinates
 */
export function parseConceptPath(
  path: string,
): {
  slug: string;
  coordinates?: { latitude: number; longitude: number };
} | null {
  const conceptMatch = path.match(
    /^\/gavoc\/c\/([^\/]+)(?:\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?))?/,
  );
  if (!conceptMatch) return null;

  const [, slug, latStr, lonStr] = conceptMatch;

  if (latStr && lonStr) {
    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lonStr);
    if (!isNaN(latitude) && !isNaN(longitude)) {
      return { slug, coordinates: { latitude, longitude } };
    }
  }

  return { slug };
}

/**
 * Find a concept by URL path
 */
export function findConceptByPath(
  concepts: GavocThesaurusEntry[],
  path: string,
): GavocThesaurusEntry | null {
  const parsed = parseConceptPath(path);
  if (!parsed) return null;

  const exactMatch = concepts.find((concept) => concept.urlPath === path);
  if (exactMatch) return exactMatch;

  const slugMatches = concepts.filter((concept) => {
    const conceptSlug = concept.urlPath.split('/').pop()?.split('/')[0];
    return conceptSlug === parsed.slug;
  });

  if (slugMatches.length === 1) {
    return slugMatches[0];
  }

  if (slugMatches.length > 1 && parsed.coordinates) {
    let closest = slugMatches[0];
    let minDistance = Infinity;

    for (const concept of slugMatches) {
      if (concept.coordinates) {
        const distance = Math.sqrt(
          Math.pow(
            concept.coordinates.latitude - parsed.coordinates.latitude,
            2,
          ) +
            Math.pow(
              concept.coordinates.longitude - parsed.coordinates.longitude,
              2,
            ),
        );
        if (distance < minDistance) {
          minDistance = distance;
          closest = concept;
        }
      }
    }

    return closest;
  }

  return slugMatches[0] || null;
}

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
