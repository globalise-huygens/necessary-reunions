import {
  buildThesaurus,
  GavocThesaurusEntry,
  generateConceptKey,
  generateThesaurusId,
  generateThesaurusPath,
  generateThesaurusUri,
} from './thesaurus';
import { FilterConfig, GavocData, GavocLocation } from './types';

/**
 * Find the thesaurus entry that corresponds to a given location
 */
export function findThesaurusEntryForLocation(
  location: GavocLocation,
  thesaurus: { entries: GavocThesaurusEntry[] },
): GavocThesaurusEntry | null {
  if (!location.thesaurusId) return null;

  return (
    thesaurus.entries.find(
      (entry: GavocThesaurusEntry) => entry.id === location.thesaurusId,
    ) || null
  );
}

/**
 * Parse coordinate string and convert to decimal degrees
 * Supports formats like: 12-30N/92-50E, 06-48N/80-29E, etc.
 */
export function parseCoordinates(
  coordString: string,
): { latitude: number; longitude: number } | null {
  if (!coordString || coordString === '-' || coordString.trim() === '') {
    return null;
  }

  try {
    const coordParts = coordString.split('/');
    if (coordParts.length !== 2) return null;

    const [latPart, lonPart] = coordParts;

    const lat = parseCoordinatePart(latPart.trim());
    const lon = parseCoordinatePart(lonPart.trim());

    if (lat === null || lon === null) return null;

    return { latitude: lat, longitude: lon };
  } catch (error) {
    console.warn('Failed to parse coordinates:', coordString, error);
    return null;
  }
}

function parseCoordinatePart(part: string): number | null {
  const direction = part.slice(-1).toUpperCase();
  const numberPart = part.slice(0, -1);

  if (!['N', 'S', 'E', 'W'].includes(direction)) return null;

  let degrees = 0;
  let minutes = 0;
  let seconds = 0;

  if (numberPart.includes('-')) {
    const [degStr, minStr] = numberPart.split('-');
    degrees = parseInt(degStr, 10);
    minutes = parseInt(minStr, 10);
  } else {
    degrees = parseInt(numberPart, 10);
  }

  if (isNaN(degrees)) return null;

  let decimal = degrees + minutes / 60 + seconds / 3600;

  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }

  return decimal;
}

/**
 * Generate a web-friendly slug from a name
 */
export function generateSlug(name: string): string {
  if (!name || name === '-') return '';

  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a unique URI for a location
 * Format: https://necessaryreunions.org/gavoc/{id}/{slug}
 * If no meaningful name exists, includes coordinates for uniqueness
 */
export function generateLocationUri(location: Partial<GavocLocation>): string {
  const baseUrl = 'https://necessaryreunions.org/gavoc';
  const id = location.id?.replace('gavoc-', '') || location.indexPage || '';

  const primaryName =
    location.presentName && location.presentName !== '-'
      ? location.presentName
      : location.originalNameOnMap || '';

  let slug = generateSlug(primaryName);

  // If no meaningful slug, use coordinates for uniqueness if available
  if (!slug && location.latitude && location.longitude) {
    const lat = Math.round(location.latitude * 100) / 100;
    const lon = Math.round(location.longitude * 100) / 100;
    slug = `${lat}-${lon}`.replace(/\./g, '_').replace(/-/g, '_');
  }

  if (slug) {
    return `${baseUrl}/${id}/${slug}`;
  } else {
    return `${baseUrl}/${id}`;
  }
}

/**
 * Generate a URL path for a location (without domain)
 * Includes coordinates for uniqueness when no meaningful name exists
 */
export function generateLocationPath(location: Partial<GavocLocation>): string {
  const id = location.id?.replace('gavoc-', '') || location.indexPage || '';

  const primaryName =
    location.presentName && location.presentName !== '-'
      ? location.presentName
      : location.originalNameOnMap || '';

  let slug = generateSlug(primaryName);

  // If no meaningful slug, use coordinates for uniqueness if available
  if (!slug && location.latitude && location.longitude) {
    const lat = Math.round(location.latitude * 100) / 100;
    const lon = Math.round(location.longitude * 100) / 100;
    slug = `${lat}-${lon}`.replace(/\./g, '_').replace(/-/g, '_');
  }

  if (slug) {
    return `/gavoc/${id}/${slug}`;
  } else {
    return `/gavoc/${id}`;
  }
}

/**
 * Parse a location path to extract ID and slug
 */
export function parseLocationPath(
  path: string,
): { id: string; slug?: string } | null {
  const gavocMatch = path.match(/^\/gavoc\/(\d+)(?:\/([^\/]+))?/);
  if (!gavocMatch) return null;

  const [, id, slug] = gavocMatch;
  return { id, slug };
}

/**
 * Extract alternative names from original and present name fields
 */
export function extractAlternativeNames(
  originalName: string,
  presentName: string,
): string[] {
  const alternatives: string[] = [];

  if (originalName && originalName !== '-') {
    alternatives.push(originalName);
  }

  if (presentName && presentName !== '-' && presentName !== originalName) {
    const presentNameParts = presentName
      .split(/[\/\\,;]/)
      .map((n) => n.trim())
      .filter((n) => n);
    alternatives.push(...presentNameParts);
  }

  return [...new Set(alternatives)];
}

/**
 * Process raw CSV data into GavocLocation objects
 */
export function processGavocData(rawData: any[]): GavocData {
  const locations: GavocLocation[] = [];
  let coordinatesCount = 0;
  const categoriesSet = new Set<string>();

  rawData.forEach((row, index) => {
    const coordinates = parseCoordinates(row['Coördinaten/Coordinates']);
    const hasCoordinates = coordinates !== null;
    if (hasCoordinates) coordinatesCount++;

    const category = row['Soortnaam/Category'] || 'unknown';
    categoriesSet.add(category);

    const originalName =
      row['Oorspr. naam op de kaart/Original name on the map'] || '';
    const presentName = row['Tegenwoordige naam/Present name'] || '';

    const csvId = row['id'] || String(index + 1);
    const indexPage = row['Index page'] || row['id'] || String(index + 1);

    const location: GavocLocation = {
      id: `gavoc-${csvId}`,
      indexPage: indexPage,
      originalNameOnMap: originalName,
      presentName: presentName,
      category: category,
      coordinates: row['Coördinaten/Coordinates'] || '',
      mapGridSquare: row['Kaartvak/Map grid square'] || '',
      map: row['Kaart/Map'] || '',
      page: row['Pagina/Page'] || '',
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude,
      uri: '',
      urlPath: '',
      alternativeNames: extractAlternativeNames(originalName, presentName),
      hasCoordinates,
      thesaurusId: '',
    };

    locations.push(location);
  });

  const thesaurus = buildThesaurus(locations);

  locations.forEach((location) => {
    // Determine the preferred term for this location
    const preferredTerm =
      location.presentName !== '-'
        ? location.presentName
        : location.originalNameOnMap;

    if (preferredTerm && preferredTerm !== '-') {
      const coordinates =
        location.latitude && location.longitude
          ? {
              latitude: location.latitude,
              longitude: location.longitude,
            }
          : undefined;

      // Generate concept key to find corresponding thesaurus entry
      const conceptKey = generateConceptKey(
        preferredTerm,
        location.category,
        coordinates,
      );
      location.thesaurusId = generateThesaurusId(conceptKey);

      // Try to find the thesaurus entry for this location
      const thesaurusEntry = thesaurus.entries.find(
        (entry: GavocThesaurusEntry) => entry.id === location.thesaurusId,
      );

      if (thesaurusEntry) {
        // Use thesaurus URI - this links locations with same concept
        location.uri = thesaurusEntry.uri;
        location.urlPath = thesaurusEntry.urlPath;
      } else {
        // Fallback to individual location URI
        location.uri = generateLocationUri(location);
        location.urlPath = generateLocationPath(location);
      }
    } else {
      // No meaningful name, use individual location URI with ID only
      location.uri = generateLocationUri(location);
      location.urlPath = generateLocationPath(location);
    }
  });

  return {
    locations,
    thesaurus,
    totalCount: locations.length,
    coordinatesCount,
    categories: Array.from(categoriesSet).sort(),
  };
}

/**
 * Filter and search locations based on various criteria
 */
export function filterGavocLocations(
  locations: GavocLocation[],
  config: FilterConfig,
): GavocLocation[] {
  let filtered = [...locations];

  if (config.hasCoordinatesOnly) {
    filtered = filtered.filter((location) => location.hasCoordinates);
  }

  if (config.categoryFilter && config.categoryFilter !== 'all') {
    filtered = filtered.filter(
      (location) => location.category === config.categoryFilter,
    );
  }

  if (config.searchQuery.trim()) {
    const query = config.searchQuery.toLowerCase().trim();
    filtered = filtered.filter((location) => {
      return (
        location.originalNameOnMap.toLowerCase().includes(query) ||
        location.presentName.toLowerCase().includes(query) ||
        location.category.toLowerCase().includes(query) ||
        location.mapGridSquare.toLowerCase().includes(query) ||
        location.map.toLowerCase().includes(query) ||
        location.page.toLowerCase().includes(query) ||
        location.alternativeNames.some((name) =>
          name.toLowerCase().includes(query),
        )
      );
    });
  }

  if (config.sortConfig) {
    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (config.sortConfig!.key) {
        case 'originalNameOnMap':
          aVal = a.originalNameOnMap;
          bVal = b.originalNameOnMap;
          break;
        case 'presentName':
          aVal = a.presentName;
          bVal = b.presentName;
          break;
        case 'category':
          aVal = a.category;
          bVal = b.category;
          break;
        case 'coordinates':
          aVal = a.coordinates;
          bVal = b.coordinates;
          break;
        case 'latitude':
          aVal = a.latitude || -999;
          bVal = b.latitude || -999;
          break;
        case 'longitude':
          aVal = a.longitude || -999;
          bVal = b.longitude || -999;
          break;
        default:
          aVal = '';
          bVal = '';
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return config.sortConfig!.direction === 'asc'
          ? aVal - bVal
          : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      if (config.sortConfig!.direction === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }

  return filtered;
}

/**
 * Export filtered data to CSV format
 */
export function exportToCSV(locations: GavocLocation[]): string {
  const headers = [
    'ID',
    'URI',
    'URL Path',
    'Original Name on Map',
    'Present Name',
    'Alternative Names',
    'Category',
    'Coordinates',
    'Latitude (Decimal)',
    'Longitude (Decimal)',
    'Map Grid Square',
    'Map',
    'Page',
  ];

  const csvRows = [
    headers.join(','),
    ...locations.map((location) =>
      [
        `"${location.indexPage}"`,
        `"${location.uri}"`,
        `"${location.urlPath}"`,
        `"${location.originalNameOnMap}"`,
        `"${location.presentName}"`,
        `"${location.alternativeNames.join('; ')}"`,
        `"${location.category}"`,
        `"${location.coordinates}"`,
        location.latitude?.toFixed(6) || '',
        location.longitude?.toFixed(6) || '',
        `"${location.mapGridSquare}"`,
        `"${location.map}"`,
        `"${location.page}"`,
      ].join(','),
    ),
  ];

  return csvRows.join('\n');
}
