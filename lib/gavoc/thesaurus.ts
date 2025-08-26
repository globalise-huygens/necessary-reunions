import { GavocLocation } from './types';

export interface GavocThesaurusEntry {
  id: string;
  preferredTerm: string;
  alternativeTerms: string[];
  category: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  locations: GavocLocation[];
  uri: string;
  urlPath: string;
}

export interface GavocThesaurus {
  entries: GavocThesaurusEntry[];
  totalConcepts: number;
  totalLocations: number;
  conceptsByCategory: Record<string, number>;
}

/**
 * Normalize a term for comparison and deduplication
 */
export function normalizeTermForComparison(term: string): string {
  if (!term || term === '-') return '';

  return term
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Clean a term by removing angle brackets and other unwanted characters
 */
export function cleanTerm(term: string): string {
  if (!term || term === '-') return '';

  return term.replace(/^<|>$/g, '').replace(/^"|"$/g, '').trim();
}

/**
 * Select the best preferred term from a list of candidates
 * Priority: 1) Shortest meaningful term, 2) Most common characters, 3) Alphabetical
 */
export function selectPreferredTerm(candidates: string[]): string {
  const validCandidates = candidates
    .map(cleanTerm) // Clean all candidates first
    .filter((term) => term && term !== '-');

  if (validCandidates.length === 0) return '';
  if (validCandidates.length === 1) return validCandidates[0];

  const scored = validCandidates.map((term) => ({
    term,
    length: term.length,
    hasSlash: term.includes('/'),
    hasParens: term.includes('(') || term.includes(')'),
    hasQuestionMark: term.includes('?'),
    isAllCaps: term === term.toUpperCase(),
  }));

  // Sort by preference criteria
  scored.sort((a, b) => {
    if (a.hasQuestionMark !== b.hasQuestionMark) {
      return a.hasQuestionMark ? 1 : -1;
    }

    if (a.hasParens !== b.hasParens) {
      return a.hasParens ? 1 : -1;
    }

    if (a.length >= 3 && b.length >= 3) {
      const lengthDiff = a.length - b.length;
      if (Math.abs(lengthDiff) > 5) {
        return lengthDiff;
      }
    }

    if (a.hasSlash !== b.hasSlash) {
      return a.hasSlash ? -1 : 1;
    }

    if (a.isAllCaps !== b.isAllCaps) {
      return a.isAllCaps ? 1 : -1;
    }

    return a.term.localeCompare(b.term);
  });

  return scored[0].term;
}

/**
 * Generate a canonical concept key for deduplication
 * This ensures the same geographic entity always gets the same concept ID
 */
export function generateConceptKey(
  preferredTerm: string,
  category: string,
  coordinates?: { latitude: number; longitude: number },
): string {
  const normalizedTerm = normalizeTermForComparison(preferredTerm);
  const normalizedCategory = category.split('/')[0].toLowerCase();

  let coordPart = '';
  if (coordinates) {
    const lat = Math.round(coordinates.latitude * 100) / 100;
    const lon = Math.round(coordinates.longitude * 100) / 100;
    coordPart = `_${lat}_${lon}`;
  }

  return `${normalizedCategory}:${normalizedTerm}${coordPart}`;
}

/**
 * Generate a stable thesaurus ID from concept key
 */
export function generateThesaurusId(conceptKey: string): string {
  const hash = conceptKey.split('').reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  return Math.abs(hash).toString(36);
}

/**
 * Generate URI for thesaurus entry - includes coordinates for geographic precision
 */
export function generateThesaurusUri(entry: GavocThesaurusEntry): string {
  const baseUrl = 'https://necessaryreunions.org/gavoc/c';
  const slug = generateSlugFromTerm(entry.preferredTerm);

  if (entry.coordinates) {
    const lat = Math.round(entry.coordinates.latitude * 100) / 100;
    const lon = Math.round(entry.coordinates.longitude * 100) / 100;
    return `${baseUrl}/${slug}/${lat.toFixed(2)}/${lon.toFixed(2)}`;
  }

  return `${baseUrl}/${slug}`;
}

/**
 * Generate URL path for thesaurus entry - includes coordinates for geographic precision
 */
export function generateThesaurusPath(entry: GavocThesaurusEntry): string {
  const slug = generateSlugFromTerm(entry.preferredTerm);

  if (entry.coordinates) {
    const lat = Math.round(entry.coordinates.latitude * 100) / 100;
    const lon = Math.round(entry.coordinates.longitude * 100) / 100;
    return `/gavoc/c/${slug}/${lat.toFixed(2)}/${lon.toFixed(2)}`;
  }

  return `/gavoc/c/${slug}`;
}

/**
 * Generate slug from preferred term
 */
export function generateSlugFromTerm(term: string): string {
  if (!term || term === '-') return '';

  return term
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Build thesaurus from location data
 */
export function buildThesaurus(locations: GavocLocation[]): GavocThesaurus {
  const conceptCandidates = new Map<
    string,
    {
      presentNames: Set<string>;
      originalNames: Set<string>;
      category: string;
      locations: GavocLocation[];
      coordinates?: { latitude: number; longitude: number };
    }
  >();

  locations.forEach((location) => {
    const presentName =
      location.presentName && location.presentName !== '-'
        ? cleanTerm(location.presentName)
        : null;
    const originalName =
      location.originalNameOnMap && location.originalNameOnMap !== '-'
        ? cleanTerm(location.originalNameOnMap)
        : null;

    if (!presentName && !originalName) return;

    const bestName = presentName || originalName!;
    const coordinates =
      location.latitude && location.longitude
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
          }
        : undefined;

    const conceptKey = generateConceptKey(
      bestName,
      location.category,
      coordinates,
    );

    if (!conceptCandidates.has(conceptKey)) {
      conceptCandidates.set(conceptKey, {
        presentNames: new Set(),
        originalNames: new Set(),
        category: location.category,
        locations: [],
        coordinates,
      });
    }

    const concept = conceptCandidates.get(conceptKey)!;

    if (presentName) concept.presentNames.add(presentName);
    if (originalName) concept.originalNames.add(originalName);
    concept.locations.push(location);

    if (!concept.coordinates && coordinates) {
      concept.coordinates = coordinates;
    }
  });

  const conceptsByCategory: Record<string, number> = {};
  const entries: GavocThesaurusEntry[] = [];
  const usedSlugs = new Set<string>();

  conceptCandidates.forEach((concept, conceptKey) => {
    const allNames = [...concept.presentNames, ...concept.originalNames];
    const preferredTerm = selectPreferredTerm(allNames);

    if (!preferredTerm) return;

    const thesaurusId = generateThesaurusId(conceptKey);

    const alternativeTerms = allNames
      .filter((name) => name !== preferredTerm)
      .filter((name, index, arr) => arr.indexOf(name) === index)
      .sort();

    const entry: GavocThesaurusEntry = {
      id: thesaurusId,
      preferredTerm,
      alternativeTerms,
      category: concept.category,
      coordinates: concept.coordinates,
      locations: concept.locations,
      uri: '',
      urlPath: '',
    };

    let baseSlug = generateSlugFromTerm(entry.preferredTerm);
    let finalSlug = baseSlug;
    let counter = 1;

    const generateUniqueKey = (
      slug: string,
      coords?: { latitude: number; longitude: number },
    ) => {
      if (coords) {
        const lat = Math.round(coords.latitude * 100) / 100;
        const lon = Math.round(coords.longitude * 100) / 100;
        return `${slug}_${lat}_${lon}`;
      }
      return slug;
    };

    let uniqueKey = generateUniqueKey(finalSlug, concept.coordinates);
    while (usedSlugs.has(uniqueKey)) {
      finalSlug = `${baseSlug}-${counter}`;
      uniqueKey = generateUniqueKey(finalSlug, concept.coordinates);
      counter++;
    }
    usedSlugs.add(uniqueKey);

    entry.preferredTerm = entry.preferredTerm;

    entry.uri = generateThesaurusUri(entry);
    entry.urlPath = generateThesaurusPath(entry);

    entries.push(entry);

    const categoryKey = concept.category;
    conceptsByCategory[categoryKey] =
      (conceptsByCategory[categoryKey] || 0) + 1;
  });

  entries.sort((a, b) => a.preferredTerm.localeCompare(b.preferredTerm));

  return {
    entries,
    totalConcepts: entries.length,
    totalLocations: locations.length,
    conceptsByCategory,
  };
}

/**
 * Find thesaurus entry by ID
 */
export function findThesaurusEntryById(
  thesaurus: GavocThesaurus,
  id: string,
): GavocThesaurusEntry | null {
  return thesaurus.entries.find((entry) => entry.id === id) || null;
}

/**
 * Find thesaurus entries by search term
 */
export function searchThesaurus(
  thesaurus: GavocThesaurus,
  searchTerm: string,
): GavocThesaurusEntry[] {
  const term = searchTerm.toLowerCase();

  return thesaurus.entries.filter(
    (entry) =>
      entry.preferredTerm.toLowerCase().includes(term) ||
      entry.alternativeTerms.some((alt) => alt.toLowerCase().includes(term)),
  );
}

/**
 * Get all alternative terms for a concept
 */
export function getAllTermsForConcept(entry: GavocThesaurusEntry): string[] {
  return [entry.preferredTerm, ...entry.alternativeTerms];
}
