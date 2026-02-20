import type { Annotation } from '../types';
import { getProjectConfig } from '../projects';

function getBaseUrl(): string {
  return typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

function encodeCanvasUri(uri: string): string {
  return typeof window !== 'undefined' && typeof btoa !== 'undefined'
    ? btoa(uri)
    : Buffer.from(uri).toString('base64');
}

/**
 * Session storage cache for direct fallback responses
 * Uses sessionStorage (not localStorage) since annotation data changes frequently
 * and shouldn't persist across browser sessions
 */
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY_PREFIX = 'anno_cache_';

interface CachedAnnotationResponse {
  items: Annotation[];
  hasMore: boolean;
  timestamp: number;
}

function getCacheKey(
  canvasId: string,
  page: number,
  projectSlug = 'neru',
): string {
  return `${CACHE_KEY_PREFIX}${projectSlug}_${encodeCanvasUri(canvasId)}_p${page}`;
}

function getCachedResponse(
  canvasId: string,
  page: number,
  projectSlug = 'neru',
): CachedAnnotationResponse | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const key = getCacheKey(canvasId, page, projectSlug);
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as CachedAnnotationResponse;
    const age = Date.now() - parsed.timestamp;

    if (age > CACHE_DURATION_MS) {
      sessionStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    // Silently fail - cache miss is expected
    return null;
  }
}

function setCachedResponse(
  canvasId: string,
  page: number,
  items: Annotation[],
  hasMore: boolean,
  projectSlug = 'neru',
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const key = getCacheKey(canvasId, page, projectSlug);
    const cached: CachedAnnotationResponse = {
      items,
      hasMore,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(key, JSON.stringify(cached));
  } catch {
    // Silently fail - quota exceeded is expected
  }
}

/**
 * Direct client-side fallback when server-side proxy fails
 * (e.g., due to AnnoRepo firewall blocking Netlify IPs)
 *
 * AUTHENTICATION NOTE:
 * The AnnoRepo container 'necessary-reunions' is configured with
 * 'readOnlyForAnonymousUsers: true', which means:
 * - READ operations work WITHOUT authentication (public access)
 * - WRITE operations (create/update/delete) REQUIRE authentication
 *
 * This direct browser→AnnoRepo fallback has the same READ access
 * as the server-side API route. No protected annotations are missed.
 */
export async function fetchAnnotationsDirectly({
  targetCanvasId,
  page = 0,
  projectSlug = 'neru',
}: {
  targetCanvasId: string;
  page?: number;
  projectSlug?: string;
}): Promise<{
  items: Annotation[];
  hasMore: boolean;
}> {
  // Check cache first
  const cached = getCachedResponse(targetCanvasId, page, projectSlug);
  if (cached) {
    return { items: cached.items, hasMore: cached.hasMore };
  }

  const config = getProjectConfig(projectSlug);
  const encoded = encodeCanvasUri(targetCanvasId);
  const url = `${config.annoRepoBaseUrl}/services/${config.annoRepoContainer}/custom-query/${config.customQueryName}:target=${encoded}`;
  const fullUrl = new URL(url);
  fullUrl.searchParams.set('page', page.toString());

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(fullUrl.toString(), {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`AnnoRepo direct access failed: ${res.status}`);
    }

    const data = (await res.json()) as {
      items?: Annotation[];
      next?: string;
    };

    const items = Array.isArray(data.items) ? data.items : [];
    const hasMore = typeof data.next === 'string';

    // Cache successful response
    setCachedResponse(targetCanvasId, page, items, hasMore, projectSlug);

    return { items, hasMore };
  } catch (error) {
    clearTimeout(timeoutId);
    const errorName = error instanceof Error ? error.name : 'Unknown';

    // Only log unexpected errors in development
    if (process.env.NODE_ENV === 'development' && errorName !== 'AbortError') {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('[fetchAnnotationsDirectly] Failed:', {
        page,
        errorName,
        errorMessage,
      });
    }
    throw error;
  }
}

export async function fetchAnnotations({
  targetCanvasId,
  page = 0,
  projectSlug = 'neru',
}: {
  targetCanvasId: string;
  page?: number;
  projectSlug?: string;
}): Promise<{
  items: Annotation[];
  hasMore: boolean;
}> {
  const url = new URL('/api/annotations/external', getBaseUrl());
  url.searchParams.set('targetCanvasId', targetCanvasId);
  url.searchParams.set('page', page.toString());
  url.searchParams.set('project', projectSlug);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10000);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorData = (await res
        .json()
        .catch(() => ({ error: 'Unknown error' }))) as { error?: string };
      // API errors trigger fallback - only log in development
      if (process.env.NODE_ENV === 'development') {
        console.error('[fetchAnnotations] API error:', {
          status: res.status,
          error: errorData.error,
        });
      }
      throw new Error(
        `Failed to fetch annotations: ${res.status} ${res.statusText}\n${
          errorData.error || 'Unknown error'
        }`,
      );
    }

    const data = (await res.json()) as {
      items: Annotation[];
      hasMore: boolean;
      debug?: any;
    };

    // If server returns 0 items with error, fall back to direct browser access
    if (data.items.length === 0 && data.debug) {
      // SocketError is expected - API times out, direct access succeeds
      // Try direct browser → AnnoRepo access
      try {
        return await fetchAnnotationsDirectly({
          targetCanvasId,
          page,
          projectSlug,
        });
      } catch (directError) {
        // Only log if direct fallback truly fails (rare)
        if (process.env.NODE_ENV === 'development') {
          console.error('[fetchAnnotations] Direct fallback also failed', {
            directError:
              directError instanceof Error
                ? directError.message
                : String(directError),
          });
        }
        // Return server response even if empty
        return data;
      }
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out after 10 seconds');
    }
    throw error;
  }
}

export async function deleteAnnotation(
  annotationUrl: string,
  projectSlug = 'neru',
): Promise<void> {
  const annotationId = annotationUrl.includes('/')
    ? annotationUrl.split('/').pop()
    : annotationUrl;

  if (!annotationId) {
    throw new Error('Invalid annotation URL or ID');
  }

  const url = new URL(
    `/api/annotations/${encodeURIComponent(annotationId)}`,
    getBaseUrl(),
  );
  url.searchParams.set('project', projectSlug);

  const response = await fetch(url.toString(), { method: 'DELETE' });

  if (!response.ok) {
    const errorData = (await response
      .json()
      .catch(() => ({ error: 'Unknown error' }))) as { error?: string };
    throw new Error(errorData.error ?? `Delete failed: ${response.status}`);
  }
}

export async function updateAnnotation(
  annotationUrl: string,
  annotation: Annotation,
  projectSlug = 'neru',
): Promise<Annotation> {
  const annotationId = annotationUrl.includes('/')
    ? annotationUrl.split('/').pop()
    : annotationUrl;

  if (!annotationId) {
    throw new Error('Invalid annotation URL or ID');
  }

  const url = new URL(
    `/api/annotations/${encodeURIComponent(annotationId)}`,
    getBaseUrl(),
  );
  url.searchParams.set('project', projectSlug);

  const response = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(annotation),
  });

  if (!response.ok) {
    const errorData = (await response
      .json()
      .catch(() => ({ error: 'Unknown error' }))) as { error?: string };
    throw new Error(errorData.error ?? `Update failed: ${response.status}`);
  }

  return (await response.json()) as Annotation;
}

export async function createAnnotation(
  annotation: Annotation,
  projectSlug = 'neru',
): Promise<Annotation> {
  const url = new URL('/api/annotations', getBaseUrl());
  url.searchParams.set('project', projectSlug);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(annotation),
  });

  if (!response.ok) {
    const errorData = (await response
      .json()
      .catch(() => ({ error: 'Unknown error' }))) as { error?: string };
    throw new Error(errorData.error ?? `Create failed: ${response.status}`);
  }

  return (await response.json()) as Annotation;
}

/**
 * Direct client-side fallback for linking annotations
 * when server-side proxy fails (e.g., AnnoRepo firewall)
 */
export async function fetchLinkingAnnotationsDirectly({
  page = 0,
  projectSlug = 'neru',
}: {
  page?: number;
  projectSlug?: string;
} = {}): Promise<{
  annotations: any[];
  iconStates: Record<
    string,
    { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
  >;
  hasMore: boolean;
  page: number;
  count: number;
}> {
  const startTime = Date.now();

  const config = getProjectConfig(projectSlug);

  const motivation = 'linking';
  const encoded =
    typeof window !== 'undefined' && typeof btoa !== 'undefined'
      ? btoa(motivation)
      : Buffer.from(motivation).toString('base64');

  const baseUrl = `${config.annoRepoBaseUrl}/services/${config.annoRepoContainer}/custom-query/${config.linkingQueryName}:target=,motivationorpurpose=${encoded}`;
  const fullUrl = page === 0 ? baseUrl : `${baseUrl}?page=${page}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10000);

  try {
    const res = await fetch(fullUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const result = (await res.json()) as {
      items?: any[];
      next?: string;
    };

    const annotations = result.items || [];

    // Build icon states
    const iconStates: Record<
      string,
      { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
    > = {};

    annotations.forEach((annotation) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- AnnoRepo response has dynamic structure
      if (annotation.target && Array.isArray(annotation.target)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- Annotation target array
        annotation.target.forEach((targetUrl: string) => {
          if (!iconStates[targetUrl]) {
            iconStates[targetUrl] = {
              hasGeotag: false,
              hasPoint: false,
              isLinked: false,
            };
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- AnnoRepo annotation body structure
          const linkingBody: any[] = Array.isArray(annotation.body)
            ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Body field
              annotation.body
            : // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Body field
              annotation.body
              ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Body field
                [annotation.body]
              : [];

          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Body purpose field
          if (linkingBody.some((b) => b.purpose === 'geotagging')) {
            iconStates[targetUrl].hasGeotag = true;
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Body purpose field
          if (linkingBody.some((b) => b.purpose === 'selecting')) {
            iconStates[targetUrl].hasPoint = true;
          }

          iconStates[targetUrl].isLinked = true;
        });
      }
    });

    return {
      annotations,
      iconStates,
      hasMore: !!result.next,
      page,
      count: annotations.length,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const errorName = error instanceof Error ? error.name : 'Unknown';
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCause =
      error instanceof Error && 'cause' in error ? String(error.cause) : 'none';

    console.error('[AnnoRepo Direct] Linking fetch failed:', {
      page,
      duration: Date.now() - startTime,
      errorName,
      errorMessage,
      errorCause,
      isTimeout: errorName === 'AbortError',
      isSocketError:
        errorMessage.includes('socket') || errorCause.includes('socket'),
    });

    return {
      annotations: [],
      iconStates: {},
      hasMore: false,
      page: 0,
      count: 0,
    };
  }
}
