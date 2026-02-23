/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * IIIF Content State API 1.0 — Encoding, Decoding, Building, and Parsing
 *
 * Implements the full Content State specification at:
 * https://iiif.io/api/content-state/1.0/
 *
 * Content State provides a standardised format for sharing a particular view
 * of one or more IIIF Presentation API resources. A content state can encode:
 * - A whole Manifest
 * - A specific Canvas (with partOf chain to Manifest)
 * - A spatial region of a Canvas (#xywh= fragment)
 * - A specific annotation on a Canvas
 * - Multiple targets for comparison views
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentStateAnnotation {
  '@context'?: string;
  id?: string;
  type: 'Annotation';
  motivation: 'contentState' | string[];
  target: ContentStateTarget | ContentStateTarget[];
}

export interface ContentStateTarget {
  id: string;
  type: 'Manifest' | 'Canvas' | 'Range' | 'SpecificResource' | string;
  partOf?: ContentStatePartOf[];
  /** For SpecificResource targets */
  source?: ContentStateSource;
  selector?: ContentStateSelector;
}

export interface ContentStatePartOf {
  id: string;
  type: 'Manifest' | 'Collection' | string;
}

export interface ContentStateSource {
  id: string;
  type: 'Canvas' | string;
  partOf?: ContentStatePartOf[];
}

export interface ContentStateSelector {
  type: 'FragmentSelector' | 'PointSelector' | 'SvgSelector' | string;
  /** For FragmentSelector: xywh region */
  value?: string;
  /** For PointSelector */
  x?: number;
  y?: number;
  t?: number;
  conformsTo?: string;
}

/**
 * Parsed content state with resolved fields ready for viewer initialisation.
 */
export interface ParsedContentState {
  /** The manifest URI to load */
  manifestId: string | null;
  /** The target canvas URI (without fragment) */
  canvasId: string | null;
  /** Spatial region on the canvas (xywh) */
  region: { x: number; y: number; w: number; h: number } | null;
  /** Annotation URI to highlight */
  annotationId: string | null;
  /** Point on the canvas */
  point: { x: number; y: number } | null;
  /** The raw content state target(s) */
  targets: ContentStateTarget[];
}

// ---------------------------------------------------------------------------
// Encoding / Decoding (Section 6)
// ---------------------------------------------------------------------------

/**
 * Encode a content state for use in a URL query parameter.
 *
 * Process (per spec Section 6.1):
 * 1. encodeURIComponent (handles UTF-16 → UTF-8 safely)
 * 2. base64url encode
 * 3. Strip padding "=" characters
 */
export function encodeContentState(plainContentState: string): string {
  const uriEncoded = encodeURIComponent(plainContentState);
  // btoa operates on Latin-1 strings; encodeURIComponent output is safe
  const base64 = btoa(uriEncoded);
  const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_');
  const base64urlNoPadding = base64url.replace(/=/g, '');
  return base64urlNoPadding;
}

/**
 * Decode a content-state-encoded string back to JSON.
 *
 * Process (per spec Section 6.1):
 * 1. Restore "=" padding
 * 2. base64url decode
 * 3. decodeURIComponent
 */
export function decodeContentState(encodedContentState: string): string {
  const base64url = restorePadding(encodedContentState);
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const base64Decoded = atob(base64);
  const uriDecoded = decodeURIComponent(base64Decoded);
  return uriDecoded;
}

/**
 * Restore base64 padding characters.
 */
function restorePadding(s: string): string {
  const pad = s.length % 4;
  if (pad === 1) {
    throw new Error(
      'InvalidLengthError: Input base64url string is the wrong length to determine padding',
    );
  }
  if (pad) {
    return s + '===='.slice(0, 4 - pad);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Building Content States
// ---------------------------------------------------------------------------

export interface BuildContentStateOptions {
  /** The full manifest URI */
  manifestId: string;
  /** Optional canvas URI to target */
  canvasId?: string;
  /** Optional xywh region on the canvas */
  region?: { x: number; y: number; w: number; h: number };
  /** Optional annotation URI to reference */
  annotationId?: string;
  /** Optional point on the canvas */
  point?: { x: number; y: number };
}

/**
 * Build a Content State Annotation from viewer state.
 * Returns the full Annotation form (Section 2.2.1).
 */
export function buildContentState(
  options: BuildContentStateOptions,
): ContentStateAnnotation {
  const { manifestId, canvasId, region, annotationId, point } = options;

  // Simple manifest-only target
  if (!canvasId) {
    return {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      type: 'Annotation',
      motivation: 'contentState',
      target: {
        id: manifestId,
        type: 'Manifest',
      },
    };
  }

  // Canvas target with optional fragment
  let canvasUri = canvasId;
  if (region) {
    canvasUri = `${canvasId}#xywh=${region.x},${region.y},${region.w},${region.h}`;
  }

  // If pointing to a specific resource (point or annotation)
  if (point || annotationId) {
    const target: ContentStateTarget = {
      id: canvasUri,
      type: 'SpecificResource',
      source: {
        id: canvasId,
        type: 'Canvas',
        partOf: [{ id: manifestId, type: 'Manifest' }],
      },
    };

    if (point) {
      target.selector = {
        type: 'PointSelector',
        x: point.x,
        y: point.y,
      };
    }

    const annotation: ContentStateAnnotation = {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      type: 'Annotation',
      motivation: 'contentState',
      target,
    };

    // Include annotation reference in an array of targets
    if (annotationId) {
      annotation.target = [
        target,
        {
          id: annotationId,
          type: 'Annotation' as any,
        } as ContentStateTarget,
      ];
    }

    return annotation;
  }

  // Standard canvas target
  return {
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    type: 'Annotation',
    motivation: 'contentState',
    target: {
      id: canvasUri,
      type: 'Canvas',
      partOf: [{ id: manifestId, type: 'Manifest' }],
    },
  };
}

/**
 * Build a compact Target Body form (Section 2.2.3) — preferred for URL brevity.
 */
export function buildContentStateTargetBody(
  options: BuildContentStateOptions,
): ContentStateTarget | ContentStateTarget[] {
  const annotation = buildContentState(options);
  return annotation.target;
}

/**
 * Build and encode a content state for use in a `?iiif-content=` URL parameter.
 * Uses the compact Target Body form for shorter URLs.
 */
export function buildEncodedContentState(
  options: BuildContentStateOptions,
): string {
  const targetBody = buildContentStateTargetBody(options);
  const json = JSON.stringify(targetBody);
  return encodeContentState(json);
}

/**
 * Build a full shareable viewer URL with encoded content state.
 */
export function buildContentStateUrl(
  baseUrl: string,
  options: BuildContentStateOptions,
): string {
  const encoded = buildEncodedContentState(options);
  return `${baseUrl}?iiif-content=${encoded}`;
}

// ---------------------------------------------------------------------------
// Parsing Content States (Section 4)
// ---------------------------------------------------------------------------

/**
 * Parse a content state from any of the 4 forms described in Section 2.2.
 *
 * Input can be:
 * - A full Content State Annotation (JSON object with type: "Annotation")
 * - A Target Body (JSON object with type: "Canvas", "Manifest", etc.)
 * - A plain URI string (manifest or annotation URI)
 * - A content-state-encoded string (base64url)
 *
 * Returns a `ParsedContentState` with resolved manifest ID, canvas ID,
 * region, and annotation references.
 */
export function parseContentState(input: string | object): ParsedContentState {
  const result: ParsedContentState = {
    manifestId: null,
    canvasId: null,
    region: null,
    annotationId: null,
    point: null,
    targets: [],
  };

  let data: any = input;

  // If a string, determine if it's an encoded content state, a JSON string, or a URI
  if (typeof data === 'string') {
    const trimmed = data.trim();

    // Try to detect JSON
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        data = JSON.parse(trimmed);
      } catch {
        // Not valid JSON, treat as URI
        return parseUri(trimmed, result);
      }
    } else if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://')
    ) {
      // Plain URI (Section 2.2.4)
      return parseUri(trimmed, result);
    } else {
      // Possibly content-state-encoded
      try {
        const decoded = decodeContentState(trimmed);
        const parsed = JSON.parse(decoded);
        data = parsed;
      } catch {
        // If decoding fails, treat as a URI
        return parseUri(trimmed, result);
      }
    }
  }

  // Now data should be an object — determine the form
  if (!data || typeof data !== 'object') {
    return result;
  }

  // Form 2.2.1: Full Annotation with motivation contentState
  // Per spec, accept any annotation encountered where content state is expected
  if (data.type === 'Annotation') {
    const targets = Array.isArray(data.target) ? data.target : [data.target];
    return parseTargets(targets, result);
  }

  // Form 2.2.3: Target Body (no Annotation wrapper)
  if (
    data.type === 'Canvas' ||
    data.type === 'Manifest' ||
    data.type === 'Range' ||
    data.type === 'Collection' ||
    data.type === 'SpecificResource'
  ) {
    return parseTargets([data], result);
  }

  // Array of targets (for comparison views, Section 5.3)
  if (Array.isArray(data)) {
    return parseTargets(data, result);
  }

  return result;
}

/**
 * Parse a plain URI into a content state.
 */
function parseUri(uri: string, result: ParsedContentState): ParsedContentState {
  // Check for xywh fragment
  const { base, region } = extractFragment(uri);

  // Determine type heuristically
  if (
    uri.includes('/manifest') ||
    uri.endsWith('.json') ||
    uri.includes('manifest.json')
  ) {
    result.manifestId = base;
  } else if (uri.includes('/canvas')) {
    result.canvasId = base;
    result.region = region;
  } else {
    // Assume it's a manifest if we can't determine
    result.manifestId = base;
  }

  return result;
}

/**
 * Parse an array of content state targets.
 */
function parseTargets(
  targets: any[],
  result: ParsedContentState,
): ParsedContentState {
  result.targets = targets;

  for (const target of targets) {
    if (!target) continue;

    // Handle Annotation type targets (e.g. linking references)
    if (target.type === 'Annotation') {
      result.annotationId = target.id;
      continue;
    }

    // SpecificResource
    if (target.type === 'SpecificResource') {
      if (target.source) {
        const source =
          typeof target.source === 'string'
            ? { id: target.source }
            : target.source;

        if (source.type === 'Canvas' || source.id?.includes('/canvas')) {
          const { base, region } = extractFragment(source.id);
          result.canvasId = base;
          result.region = region || result.region;

          // Extract manifest from partOf
          if (source.partOf) {
            const manifestRef = source.partOf.find(
              (p: any) => p.type === 'Manifest',
            );
            if (manifestRef) {
              result.manifestId = manifestRef.id;
            }
          }
        }
      }

      // Check selector
      if (target.selector) {
        if (target.selector.type === 'PointSelector') {
          result.point = {
            x: target.selector.x ?? 0,
            y: target.selector.y ?? 0,
          };
        } else if (target.selector.type === 'FragmentSelector') {
          const match = target.selector.value?.match(
            /xywh=(\d+),(\d+),(\d+),(\d+)/,
          );
          if (match) {
            result.region = {
              x: parseInt(match[1]),
              y: parseInt(match[2]),
              w: parseInt(match[3]),
              h: parseInt(match[4]),
            };
          }
        }
      }
      continue;
    }

    // Canvas
    if (target.type === 'Canvas') {
      const { base, region } = extractFragment(target.id);
      result.canvasId = base;
      result.region = region || result.region;

      if (target.partOf) {
        const manifestRef = target.partOf.find(
          (p: any) => p.type === 'Manifest',
        );
        if (manifestRef) {
          result.manifestId = manifestRef.id;
        }
      }
      continue;
    }

    // Manifest
    if (target.type === 'Manifest') {
      result.manifestId = target.id;
      continue;
    }

    // Range
    if (target.type === 'Range') {
      if (target.partOf) {
        const manifestRef = target.partOf.find(
          (p: any) => p.type === 'Manifest',
        );
        if (manifestRef) {
          result.manifestId = manifestRef.id;
        }
      }
      continue;
    }
  }

  return result;
}

/**
 * Extract xywh fragment from a URI.
 */
function extractFragment(uri: string): {
  base: string;
  region: { x: number; y: number; w: number; h: number } | null;
} {
  const hashIndex = uri.indexOf('#');
  if (hashIndex === -1) {
    return { base: uri, region: null };
  }

  const base = uri.slice(0, hashIndex);
  const fragment = uri.slice(hashIndex + 1);
  const match = fragment.match(/xywh=(\d+),(\d+),(\d+),(\d+)/);

  if (match) {
    return {
      base,
      region: {
        x: parseInt(match[1]!, 10),
        y: parseInt(match[2]!, 10),
        w: parseInt(match[3]!, 10),
        h: parseInt(match[4]!, 10),
      },
    };
  }

  return { base, region: null };
}

// ---------------------------------------------------------------------------
// Convenience: Build shareable URL for current viewer state
// ---------------------------------------------------------------------------

/**
 * Build a shareable URL for the current viewer state using IIIF Content State.
 * The URL can be opened by any IIIF Content State-compatible viewer.
 */
export function buildShareableUrl(options: {
  /** Base viewer URL — e.g. "https://necessary-reunions.netlify.app/viewer" */
  viewerBaseUrl: string;
  /** Manifest URI */
  manifestId: string;
  /** Canvas URI (optional) */
  canvasId?: string;
  /** Viewport region (optional) */
  region?: { x: number; y: number; w: number; h: number };
  /** Selected annotation (optional) */
  annotationId?: string;
  /** Point on canvas (optional) */
  point?: { x: number; y: number };
}): string {
  const { viewerBaseUrl, manifestId, canvasId, region, annotationId, point } =
    options;

  return buildContentStateUrl(viewerBaseUrl, {
    manifestId,
    canvasId,
    region,
    annotationId,
    point,
  });
}
