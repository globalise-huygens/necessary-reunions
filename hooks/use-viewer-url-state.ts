'use client';

import type { Manifest } from '@/lib/types';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import {
  parseContentState,
  type ParsedContentState,
} from '../lib/viewer/content-state';
import { getManifestCanvases } from '../lib/viewer/iiif-helpers';

/**
 * URL query parameter keys used by the viewer.
 *
 * - `project`    – Project slug (e.g. "neru", "suriname")
 * - `canvas`     – Short canvas slug (e.g. "c5", "1") or full canvas URI
 * - `tab`        – Right-panel view mode: "info" | "annotation" | "map"
 * - `annotation` – Selected annotation ID (short or full URI)
 * - `iiif-content` – Encoded IIIF Content State (takes precedence)
 */
export interface ViewerUrlState {
  project?: string;
  canvas?: string;
  tab?: 'info' | 'annotation' | 'map';
  annotation?: string;
  iiifContent?: string;
}

/**
 * Extract the short slug from a canvas URI.
 * e.g. `https://example.org/iiif/canvas/c5` → `c5`
 */
function extractCanvasSlug(canvasUri: string): string {
  return canvasUri.split('/').pop() || canvasUri;
}

/**
 * Resolve a canvas parameter to an index within the manifest.
 * Accepts a short slug ("c5"), numeric index ("3"), or full canvas URI.
 */
export function resolveCanvasIndex(
  manifest: Manifest | null,
  canvasParam: string | null,
): number | null {
  if (!canvasParam || !manifest) return null;

  const canvases = getManifestCanvases(manifest) as { id: string }[];
  const decoded = decodeURIComponent(canvasParam);

  // 1. Exact match on full URI
  const exactIdx = canvases.findIndex(
    (c) => c.id === decoded || c.id === canvasParam,
  );
  if (exactIdx >= 0) return exactIdx;

  // 2. Match by short slug (last path segment of canvas URI)
  const slugIdx = canvases.findIndex(
    (c) => extractCanvasSlug(c.id) === decoded,
  );
  if (slugIdx >= 0) return slugIdx;

  // 3. Numeric index fallback
  const asNumber = Number(canvasParam);
  if (!Number.isNaN(asNumber) && Number.isInteger(asNumber) && asNumber >= 0) {
    if (asNumber < canvases.length) {
      return asNumber;
    }
  }

  return null;
}

/**
 * Map the `tab` query parameter to the internal `viewMode` values.
 */
export function resolveViewMode(
  tabParam: string | null,
): 'image' | 'annotation' | 'map' | null {
  switch (tabParam) {
    case 'info':
      return 'image'; // "info" shows the metadata/info panel – viewMode "image"
    case 'annotation':
      return 'annotation';
    case 'map':
      return 'map';
    default:
      return null;
  }
}

/**
 * Map internal viewMode back to the URL tab parameter.
 */
function viewModeToTab(viewMode: 'image' | 'annotation' | 'map'): string {
  switch (viewMode) {
    case 'image':
      return 'info';
    case 'annotation':
      return 'annotation';
    case 'map':
      return 'map';
    default:
      return 'info';
  }
}

interface UseViewerUrlStateOptions {
  /** Current manifest (needed for canvas URI ↔ index resolution) */
  manifest: Manifest | null;
  /** Current canvas index in ManifestViewer state */
  currentCanvasIndex: number;
  /** Current view mode */
  viewMode: 'image' | 'annotation' | 'map';
  /** Currently selected annotation ID */
  selectedAnnotationId: string | null;
  /** Project slug */
  projectSlug: string;
}

interface UseViewerUrlStateReturn {
  /** Initial state parsed from URL on mount */
  initialState: ViewerUrlState;
  /** Parsed IIIF Content State (null if no iiif-content param) */
  parsedContentState: ParsedContentState | null;
  /** Update URL to reflect current viewer state (debounced) */
  syncToUrl: () => void;
}

/**
 * Hook that reads initial viewer state from URL search params and
 * provides a function to sync current state back to the URL.
 *
 * Uses `history.replaceState` to avoid polluting the browser history.
 */
export function useViewerUrlState(
  options: UseViewerUrlStateOptions,
): UseViewerUrlStateReturn {
  const searchParams = useSearchParams();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialReadDone = useRef(false);

  // Read initial state from URL (only once)
  const initialState: ViewerUrlState = {
    project: searchParams.get('project') ?? undefined,
    canvas: searchParams.get('canvas') ?? undefined,
    tab: (searchParams.get('tab') as ViewerUrlState['tab']) ?? undefined,
    annotation: searchParams.get('annotation') ?? undefined,
    iiifContent: searchParams.get('iiif-content') ?? undefined,
  };

  // Parse IIIF Content State if present (takes precedence over other params)
  const parsedContentState: ParsedContentState | null = (() => {
    if (!initialState.iiifContent) return null;
    try {
      return parseContentState(initialState.iiifContent);
    } catch (e) {
      console.warn('[useViewerUrlState] Failed to parse iiif-content:', e);
      return null;
    }
  })();

  // Sync current viewer state → URL (debounced replaceState)
  const syncToUrl = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();

      // Always include project
      if (options.projectSlug) {
        params.set('project', options.projectSlug);
      }

      // Canvas – use short slug for clean URLs
      if (options.manifest) {
        const canvases = getManifestCanvases(options.manifest) as {
          id: string;
        }[];
        const canvas = canvases[options.currentCanvasIndex];
        if (canvas?.id) {
          params.set('canvas', extractCanvasSlug(canvas.id));
        }
      }

      // Tab – only include if not the default ("info")
      if (options.viewMode !== 'image') {
        params.set('tab', viewModeToTab(options.viewMode));
      }

      // Annotation
      if (options.selectedAnnotationId) {
        // Use the short ID (last segment) for cleaner URLs
        const shortId =
          options.selectedAnnotationId.split('/').pop() ||
          options.selectedAnnotationId;
        params.set('annotation', shortId);
      }

      const newUrl = `/viewer${params.toString() ? `?${params.toString()}` : ''}`;

      // Use replaceState to avoid browser history pollution
      if (typeof window !== 'undefined') {
        window.history.replaceState(window.history.state, '', newUrl);
      }
    }, 300);
  }, [
    options.projectSlug,
    options.manifest,
    options.currentCanvasIndex,
    options.viewMode,
    options.selectedAnnotationId,
  ]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Mark initial read as done after first render
  useEffect(() => {
    isInitialReadDone.current = true;
  }, []);

  return { initialState, parsedContentState, syncToUrl };
}
