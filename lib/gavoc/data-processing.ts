import { FilterConfig, GavocData, GavocLocation } from './types';

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
  // Extract direction (N/S/E/W)
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
 * Generate a unique URI for a location
 * Format: gavoc:location:{type}:{normalized-name}:{coordinates-hash}
 */
export function generateLocationUri(location: Partial<GavocLocation>): string {
  const baseUri = 'gavoc:location';

  const primaryName =
    location.presentName && location.presentName !== '-'
      ? location.presentName
      : location.originalNameOnMap || '';

  const normalizedName = primaryName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const uniqueIdentifier =
    location.coordinates && location.coordinates !== '-'
      ? location.coordinates.replace(/[^0-9NSEW-]/g, '')
      : location.mapGridSquare || location.indexPage || '';

  const category = location.category?.split('/')[0] || 'unknown';

  return `${baseUri}:${category}:${normalizedName}:${uniqueIdentifier}`;
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

  return [...new Set(alternatives)]; // Remove duplicates
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

    const location: GavocLocation = {
      id: `gavoc-${index + 1}`,
      indexPage: row['Index page'] || '',
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
      alternativeNames: extractAlternativeNames(originalName, presentName),
      hasCoordinates,
    };

    location.uri = generateLocationUri(location);

    locations.push(location);
  });

  return {
    locations,
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
    'URI',
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
    'Index Page',
  ];

  const csvRows = [
    headers.join(','),
    ...locations.map((location) =>
      [
        location.uri,
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
        `"${location.indexPage}"`,
      ].join(','),
    ),
  ];

  return csvRows.join('\n');
}
