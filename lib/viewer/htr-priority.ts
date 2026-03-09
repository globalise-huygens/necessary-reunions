/**
 * HTR (Handwritten Text Recognition) priority lookup for Suriname maps.
 *
 * Keyed by 1-based canvas number (the "id" column in the workshop TSV,
 * matching position in the Suriname manifest). Each entry stores a
 * priority (0-6) and an optional link (handle or IIIF manifest URL).
 */

export interface HtrPriorityEntry {
  priority: number;
  link?: string;
}

export type HtrPriorityMap = Record<string, HtrPriorityEntry>;

/**
 * Load the HTR priority map for the Suriname project.
 * Returns an empty object on failure so the UI degrades gracefully.
 */
export async function loadHtrPriorityMap(): Promise<HtrPriorityMap> {
  try {
    const res = await fetch('/suriname-htr-priority.json');
    if (!res.ok) return {};
    return (await res.json()) as HtrPriorityMap;
  } catch {
    return {};
  }
}

/**
 * Get the HTR priority entry for a canvas by its 1-based position.
 * Returns the entry or null when the canvas has no priority data.
 */
export function getCanvasHtrEntry(
  canvasIndex: number,
  priorityMap: HtrPriorityMap,
): HtrPriorityEntry | null {
  if (Object.keys(priorityMap).length === 0) return null;
  const key = String(canvasIndex + 1);
  return priorityMap[key] ?? null;
}
