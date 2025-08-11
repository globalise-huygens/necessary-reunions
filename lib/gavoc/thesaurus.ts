import { GavocLocation } from './types';

export interface GavocThesaurusEntry {
  id: string; // Unique identifier for the thesaurus entry
  preferredTerm: string; // The present name (canonical form)
  alternativeTerms: string[]; // All original names that map to this term
  category: string; // Primary category
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  locations: GavocLocation[]; // All individual entries that belong to this thesaurus entry
  uri: string; // Canonical URI for this concept
  urlPath: string; // Canonical URL path
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
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric
    .trim();
}

/**
 * Select the best preferred term from a list of candidates
 * Priority: 1) Shortest meaningful term, 2) Most common characters, 3) Alphabetical
 */
export function selectPreferredTerm(candidates: string[]): string {
  const validCandidates = candidates.filter((term) => term && term !== '-');
  if (validCandidates.length === 0) return '';
  if (validCandidates.length === 1) return validCandidates[0];

  // Score each candidate
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
    // Prefer terms without question marks
    if (a.hasQuestionMark !== b.hasQuestionMark) {
      return a.hasQuestionMark ? 1 : -1;
    }

    // Prefer terms without parentheses
    if (a.hasParens !== b.hasParens) {
      return a.hasParens ? 1 : -1;
    }

    // Prefer shorter terms (but not too short)
    if (a.length >= 3 && b.length >= 3) {
      const lengthDiff = a.length - b.length;
      if (Math.abs(lengthDiff) > 5) {
        return lengthDiff;
      }
    }

    // Prefer terms with slashes (often contain both historical and modern names)
    if (a.hasSlash !== b.hasSlash) {
      return a.hasSlash ? -1 : 1;
    }

    // Prefer mixed case over all caps
    if (a.isAllCaps !== b.isAllCaps) {
      return a.isAllCaps ? 1 : -1;
    }

    // Finally, alphabetical
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

  // Include rounded coordinates for disambiguation if available
  let coordPart = '';
  if (coordinates) {
    const lat = Math.round(coordinates.latitude * 100) / 100; // Round to 2 decimals
    const lon = Math.round(coordinates.longitude * 100) / 100;
    coordPart = `_${lat}_${lon}`;
  }

  return `${normalizedCategory}:${normalizedTerm}${coordPart}`;
}

/**
 * Generate a stable thesaurus ID from concept key
 */
export function generateThesaurusId(conceptKey: string): string {
  // Just use a simple hash of the concept key for uniqueness
  const hash = conceptKey.split('').reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  return Math.abs(hash).toString(36);
}

/**
 * Generate URI for thesaurus entry - ALWAYS uses the preferred term
 */
export function generateThesaurusUri(entry: GavocThesaurusEntry): string {
  const baseUrl = 'https://necessaryreunions.org/gavoc/c';
  const slug = generateSlugFromTerm(entry.preferredTerm);
  return `${baseUrl}/${slug}`;
}

/**
 * Generate URL path for thesaurus entry
 */
export function generateThesaurusPath(entry: GavocThesaurusEntry): string {
  const slug = generateSlugFromTerm(entry.preferredTerm);
  return `/gavoc/c/${slug}`;
}

/**
 * Generate slug from preferred term
 */
export function generateSlugFromTerm(term: string): string {
  if (!term || term === '-') return '';

  return term
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Build thesaurus from location data
 */
export function buildThesaurus(locations: GavocLocation[]): GavocThesaurus {
  // First pass: collect all candidates for each concept
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
    // Collect all potential names for this location
    const presentName =
      location.presentName && location.presentName !== '-'
        ? location.presentName
        : null;
    const originalName =
      location.originalNameOnMap && location.originalNameOnMap !== '-'
        ? location.originalNameOnMap
        : null;

    if (!presentName && !originalName) return; // Skip if no meaningful names

    // Create initial concept key based on the best available name
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

    // Update coordinates if not set and this location has coordinates
    if (!concept.coordinates && coordinates) {
      concept.coordinates = coordinates;
    }
  });

  // Second pass: create final thesaurus entries with canonical preferred terms
  const conceptsByCategory: Record<string, number> = {};
  const entries: GavocThesaurusEntry[] = [];
  const usedSlugs = new Set<string>(); // Track used slugs to avoid conflicts

  conceptCandidates.forEach((concept, conceptKey) => {
    // Select the best preferred term from all available names
    const allNames = [...concept.presentNames, ...concept.originalNames];
    const preferredTerm = selectPreferredTerm(allNames);

    if (!preferredTerm) return;

    // Generate stable ID
    const thesaurusId = generateThesaurusId(conceptKey);

    // Collect alternative terms (everything except the preferred term)
    const alternativeTerms = allNames
      .filter((name) => name !== preferredTerm)
      .filter((name, index, arr) => arr.indexOf(name) === index) // Remove duplicates
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

    // Generate unique URI and path
    let baseSlug = generateSlugFromTerm(entry.preferredTerm);
    let finalSlug = baseSlug;
    let counter = 1;

    // Handle slug conflicts by adding a number
    while (usedSlugs.has(finalSlug)) {
      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }
    usedSlugs.add(finalSlug);

    // Generate URI with the unique slug
    entry.uri = `https://necessaryreunions.org/gavoc/c/${finalSlug}`;
    entry.urlPath = `/gavoc/c/${finalSlug}`;

    entries.push(entry);

    // Count by category
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
