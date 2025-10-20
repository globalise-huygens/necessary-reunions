import { parseLocationPath } from './data-processing';
import type { GavocThesaurusEntry } from './thesaurus';
import type { GavocLocation } from './types';

export function parseConceptPath(path: string): {
  slug: string;
  coordinates?: { latitude: number; longitude: number };
} | null {
  const conceptMatch = path.match(
    /^\/gavoc\/c\/([^/]+)(?:\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?))?/,
  );
  if (!conceptMatch) return null;

  const [, slug, latStr, lonStr] = conceptMatch;
  if (!slug) return null;

  if (latStr && lonStr) {
    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lonStr);
    if (!isNaN(latitude) && !isNaN(longitude)) {
      return { slug, coordinates: { latitude, longitude } };
    }
  }

  return { slug };
}

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
    return slugMatches[0] ?? null;
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

    return closest ?? null;
  }

  return slugMatches[0] || null;
}

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

export function findLocationByPath(
  locations: GavocLocation[],
  path: string,
): GavocLocation | null {
  const parsed = parseLocationPath(path);
  if (!parsed) return null;

  return findLocationById(locations, parsed.id);
}

export function getCurrentLocationFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  const parsed = parseLocationPath(window.location.pathname);
  return parsed?.id || null;
}

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

export function getShareableUrl(location: GavocLocation): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${location.urlPath}`;
  }
  return location.uri || '';
}
