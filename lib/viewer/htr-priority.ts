/**
 * HTR (Handwritten Text Recognition) priority lookup for Suriname maps.
 *
 * Keyed by 0-based canvas index. Entries are matched to the workshop TSV
 * via IIIF service URLs and fuzzy label matching (see gen-htr-priority-v2.py).
 * Each entry stores a priority (0-6) and an optional link (handle or IIIF URL).
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
 * Get the HTR priority entry for a canvas by its 0-based index.
 * Returns the entry or null when the canvas has no priority data.
 */
export function getCanvasHtrEntry(
  canvasIndex: number,
  priorityMap: HtrPriorityMap,
): HtrPriorityEntry | null {
  if (Object.keys(priorityMap).length === 0) return null;
  return priorityMap[String(canvasIndex)] ?? null;
}
