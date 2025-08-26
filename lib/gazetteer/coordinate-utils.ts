/**
 * Utility functions for handling different types of coordinates in the gazetteer
 */

export interface Coordinates {
  x: number;
  y: number;
}

/**
 * Determines if coordinates are pixel coordinates (from scanned maps) or geographic coordinates
 *
 * Pixel coordinates are typically:
 * - Large integer values (hundreds to thousands)
 * - Represent positions on scanned historical map images
 *
 * Geographic coordinates are typically:
 * - Decimal values between -180 and 180
 * - Represent actual latitude/longitude positions
 */
export function arePixelCoordinates(coordinates: Coordinates): boolean {
  const { x, y } = coordinates;

  // Check if both coordinates are large integers (typical of pixel coordinates)
  // Pixel coordinates are usually > 100 and often > 1000
  // Geographic coordinates for this region would be roughly:
  // Latitude (y): 8-15° N, Longitude (x): 75-78° E
  const isLargeNumber = x > 180 || y > 180;
  const isInteger = Number.isInteger(x) && Number.isInteger(y);

  return isLargeNumber || (isInteger && (x > 100 || y > 100));
}

/**
 * Formats coordinates for display based on their type
 */
export function formatCoordinatesForDisplay(coordinates: Coordinates): {
  formatted: string;
  type: 'pixel' | 'geographic';
} {
  if (arePixelCoordinates(coordinates)) {
    return {
      formatted: `${coordinates.x}, ${coordinates.y}`,
      type: 'pixel',
    };
  } else {
    return {
      formatted: `${coordinates.y.toFixed(6)}°, ${coordinates.x.toFixed(6)}°`,
      type: 'geographic',
    };
  }
}

/**
 * Checks if coordinates should be displayed in the UI
 * Pixel coordinates are generally not meaningful to end users
 */
export function shouldDisplayCoordinates(coordinates: Coordinates): boolean {
  return !arePixelCoordinates(coordinates);
}

/**
 * Gets a user-friendly label for coordinate type
 */
export function getCoordinateTypeLabel(coordinates: Coordinates): string {
  if (arePixelCoordinates(coordinates)) {
    return 'Map Position';
  } else {
    return 'Geographic Location';
  }
}
