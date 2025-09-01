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
export function arePixelCoordinates(
  coordinates: Coordinates | null | undefined,
): boolean {
  if (
    !coordinates ||
    coordinates.x === undefined ||
    coordinates.y === undefined
  ) {
    return false;
  }

  const { x, y } = coordinates;

  const isLargeNumber = x > 180 || y > 180;
  const isInteger = Number.isInteger(x) && Number.isInteger(y);

  return isLargeNumber || (isInteger && (x > 100 || y > 100));
}

/**
 * Formats coordinates for display based on their type
 */
export function formatCoordinatesForDisplay(
  coordinates: Coordinates | null | undefined,
): {
  formatted: string;
  type: 'pixel' | 'geographic';
} {
  if (
    !coordinates ||
    coordinates.x === undefined ||
    coordinates.y === undefined
  ) {
    return {
      formatted: 'No coordinates',
      type: 'pixel',
    };
  }

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
export function shouldDisplayCoordinates(
  coordinates: Coordinates | null | undefined,
): boolean {
  if (
    !coordinates ||
    coordinates.x === undefined ||
    coordinates.y === undefined
  ) {
    return false;
  }
  return !arePixelCoordinates(coordinates);
}

/**
 * Gets a user-friendly label for coordinate type
 */
export function getCoordinateTypeLabel(
  coordinates: Coordinates | null | undefined,
): string {
  if (
    !coordinates ||
    coordinates.x === undefined ||
    coordinates.y === undefined
  ) {
    return 'No coordinates';
  }
  if (arePixelCoordinates(coordinates)) {
    return 'Map Position';
  } else {
    return 'Geographic Location';
  }
}
