import { getProjectConfig } from '../projects';
import { safeJson } from '../shared/utils';
import type { Annotation } from '../types';

function getBaseUrl(): string {
  return typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

// ---------------------------------------------------------------------------
// Direct browser → AnnoRepo client
// ---------------------------------------------------------------------------

interface AnnoRepoToken {
  token: string;
  user: { id: string; label: string };
  fetchedAt: number;
}

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
let cachedToken: AnnoRepoToken | null = null;
let tokenPromise: Promise<AnnoRepoToken | null> | null = null;

/**
 * Fetch the AnnoRepo bearer token from the authenticated config endpoint.
 * Cached in memory and refreshed every 10 minutes.
 */
export async function getAnnoRepoToken(
  projectSlug = 'neru',
): Promise<AnnoRepoToken | null> {
  if (cachedToken && Date.now() - cachedToken.fetchedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }

  // Deduplicate concurrent requests
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    try {
      const res = await fetch(
        `${getBaseUrl()}/api/annotations/config?project=${encodeURIComponent(projectSlug)}`,
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        token: string;
        user: { id: string; label: string };
      };
      cachedToken = { ...data, fetchedAt: Date.now() };
      return cachedToken;
    } catch {
      return null;
    } finally {
      tokenPromise = null;
    }
  })();

  return tokenPromise;
}

/** Clear the cached token (call on sign-out or permission change). */
export function clearAnnoRepoTokenCache(): void {
  cachedToken = null;
}

export async function directFetch(
  url: string,
  init: RequestInit,
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getETag(
  annotationUrl: string,
  token: string,
): Promise<string> {
  const res = await directFetch(annotationUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ETag: ${res.status} ${res.statusText}`);
  }
  const etag = res.headers.get('ETag');
  if (!etag) throw new Error('Annotation does not have an ETag');
  return etag;
}

/** POST annotation directly to AnnoRepo from the browser. */
async function createAnnotationDirect(
  annotation: Annotation,
  projectSlug = 'neru',
): Promise<Annotation> {
  const tokenInfo = await getAnnoRepoToken(projectSlug);
  if (!tokenInfo)
    throw new Error('Not authenticated for direct AnnoRepo access');

  const config = getProjectConfig(projectSlug);
  const url = `${config.annoRepoBaseUrl}/w3c/${config.annoRepoContainer}/`;

  const body = {
    '@context': 'http://www.w3.org/ns/anno.jsonld',
    ...annotation,
    creator: annotation.creator || {
      id: tokenInfo.user.id,
      type: 'Person',
      label: tokenInfo.user.label || 'Unknown User',
    },
    created: annotation.created || new Date().toISOString(),
  };

  const res = await directFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':
        'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      Authorization: `Bearer ${tokenInfo.token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(
      `AnnoRepo creation failed: ${res.status} ${errorText.slice(0, 200)}`,
    );
  }

  return (await res.json()) as Annotation;
}

/** Resolve an annotation reference (bare ID or full URL) to a full AnnoRepo URL. */
function resolveAnnotationUrl(
  annotationRef: string,
  projectSlug = 'neru',
): string {
  if (annotationRef.startsWith('https://') || annotationRef.startsWith('http://')) {
    return annotationRef;
  }
  const config = getProjectConfig(projectSlug);
  return `${config.annoRepoBaseUrl}/w3c/${config.annoRepoContainer}/${encodeURIComponent(annotationRef)}`;
}

/** PUT annotation directly to AnnoRepo from the browser. */
async function updateAnnotationDirect(
  annotationUrl: string,
  annotation: Annotation,
  projectSlug = 'neru',
): Promise<Annotation> {
  const tokenInfo = await getAnnoRepoToken(projectSlug);
  if (!tokenInfo)
    throw new Error('Not authenticated for direct AnnoRepo access');

  const fullUrl = resolveAnnotationUrl(annotationUrl, projectSlug);
  const etag = await getETag(fullUrl, tokenInfo.token);

  const body = {
    '@context': 'http://www.w3.org/ns/anno.jsonld',
    ...annotation,
    modified: new Date().toISOString(),
  };

  const res = await directFetch(fullUrl, {
    method: 'PUT',
    headers: {
      'Content-Type':
        'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      Authorization: `Bearer ${tokenInfo.token}`,
      'If-Match': etag,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(
      `AnnoRepo update failed: ${res.status} ${errorText.slice(0, 200)}`,
    );
  }

  return (await res.json()) as Annotation;
}

/** DELETE annotation directly from AnnoRepo via the browser. */
async function deleteAnnotationDirect(
  annotationUrl: string,
  projectSlug = 'neru',
): Promise<void> {
  const tokenInfo = await getAnnoRepoToken(projectSlug);
  if (!tokenInfo)
    throw new Error('Not authenticated for direct AnnoRepo access');

  const fullUrl = resolveAnnotationUrl(annotationUrl, projectSlug);
  const etag = await getETag(fullUrl, tokenInfo.token);

  const res = await directFetch(fullUrl, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${tokenInfo.token}`,
      'If-Match': etag,
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(
      `AnnoRepo deletion failed: ${res.status} ${errorText.slice(0, 200)}`,
    );
  }

  // Client-side cascade delete
  await cascadeDeleteFromLinkingClient(
    [fullUrl],
    tokenInfo.token,
    projectSlug,
  );
}

// ---------------------------------------------------------------------------
// Client-side cascade delete  (mirrors lib/viewer/cascade-delete-linking.ts)
// ---------------------------------------------------------------------------

async function cascadeDeleteFromLinkingClient(
  deletedAnnotationIds: string[],
  token: string,
  projectSlug = 'neru',
): Promise<void> {
  const config = getProjectConfig(projectSlug);
  const motivationB64 =
    typeof btoa !== 'undefined'
      ? btoa('linking')
      : Buffer.from('linking').toString('base64');

  const queryUrl = `${config.annoRepoBaseUrl}/services/${config.annoRepoContainer}/custom-query/${config.linkingQueryName}:target=,motivationorpurpose=${motivationB64}`;

  let linkingAnnotations: any[] = [];
  try {
    const res = await directFetch(
      queryUrl,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept:
            'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        },
      },
      10000,
    );

    if (res.ok) {
      const data = await res.json();
      linkingAnnotations = Array.isArray(data)
        ? data
        : data.items || data.first?.items || [];
    }
  } catch {
    // Non-critical — cascade failure is logged but not fatal
    return;
  }

  const affected = linkingAnnotations.filter((linking: any) => {
    const targets: string[] = Array.isArray(linking.target)
      ? linking.target
      : [linking.target];
    return targets.some((t: string) =>
      deletedAnnotationIds.some(
        (del) => t === del || t.endsWith(`/${del}`) || del.endsWith(`/${t}`),
      ),
    );
  });

  for (const linking of affected) {
    const targets: string[] = (
      Array.isArray(linking.target) ? linking.target : [linking.target]
    ).filter(
      (t: string) =>
        !deletedAnnotationIds.some(
          (del) => t === del || t.endsWith(`/${del}`) || del.endsWith(`/${t}`),
        ),
    );

    const bodyArr = Array.isArray(linking.body)
      ? linking.body
      : linking.body
        ? [linking.body]
        : [];
    const hasEnhancements = bodyArr.some(
      (b: any) => b.purpose === 'geotagging' || b.purpose === 'selecting',
    );

    const shouldDelete =
      targets.length === 0 || (targets.length === 1 && !hasEnhancements);

    try {
      const etagVal = await getETag(linking.id, token);

      if (shouldDelete) {
        await directFetch(linking.id, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'If-Match': etagVal },
        });
      } else {
        await directFetch(linking.id, {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
            Authorization: `Bearer ${token}`,
            'If-Match': etagVal,
          },
          body: JSON.stringify({
            ...linking,
            target: targets.length === 1 ? targets[0] : targets,
            modified: new Date().toISOString(),
          }),
        });
      }
    } catch (err) {
      console.error(`[cascade] Failed for ${linking.id}:`, err);
    }
  }
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
 * Invalidate all cached annotation pages for a given canvas.
 * Call this after creating, updating, or deleting annotations so that
 * the next fetch retrieves fresh data from AnnoRepo.
 */
export function invalidateAnnotationCache(
  canvasId: string,
  projectSlug = 'neru',
): void {
  if (typeof window === 'undefined') return;
  try {
    const prefix = `${CACHE_KEY_PREFIX}${projectSlug}_${encodeCanvasUri(canvasId)}_p`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // Silently fail
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
      // Return empty page on server errors — the pagination loop
      // uses Promise.allSettled, so other pages still succeed
      return { items: [], hasMore: false };
    }

    const data = await safeJson<{
      items?: Annotation[];
      next?: string;
    }>(res);

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
      console.error(
        `[fetchAnnotationsDirectly] Failed: ${errorName}: ${errorMessage}`,
      );
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
  // Try direct browser → AnnoRepo first (bypasses Netlify serverless)
  try {
    return await fetchAnnotationsDirectly({
      targetCanvasId,
      page,
      projectSlug,
    });
  } catch {
    // Fall through to API route
  }

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
      return { items: [], hasMore: false };
    }

    const data = await safeJson<{
      items: Annotation[];
      hasMore: boolean;
    }>(res);

    return data;
  } catch {
    clearTimeout(timeoutId);
    return { items: [], hasMore: false };
  }
}

export async function deleteAnnotation(
  annotationUrl: string,
  projectSlug = 'neru',
): Promise<void> {
  // Try direct browser → AnnoRepo first (bypasses Netlify serverless)
  try {
    await deleteAnnotationDirect(annotationUrl, projectSlug);
    return;
  } catch (directErr) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[deleteAnnotation] Direct failed, trying API route:',
        directErr,
      );
    }
  }

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
  // Try direct browser → AnnoRepo first (bypasses Netlify serverless)
  try {
    return await updateAnnotationDirect(annotationUrl, annotation, projectSlug);
  } catch (directErr) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[updateAnnotation] Direct failed, trying API route:',
        directErr,
      );
    }
  }

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

  return await safeJson<Annotation>(response);
}

export async function createAnnotation(
  annotation: Annotation,
  projectSlug = 'neru',
): Promise<Annotation> {
  // Try direct browser → AnnoRepo first (bypasses Netlify serverless)
  try {
    return await createAnnotationDirect(annotation, projectSlug);
  } catch (directErr) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[createAnnotation] Direct failed, trying API route:',
        directErr,
      );
    }
  }

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

  return await safeJson<Annotation>(response);
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

    const result = await safeJson<{
      items?: any[];
      next?: string;
    }>(res);

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

    if (errorName !== 'AbortError') {
      console.error(
        `[AnnoRepo Direct] Linking fetch failed: ${errorName}: ${errorMessage}`,
      );
    }

    return {
      annotations: [],
      iconStates: {},
      hasMore: false,
      page: 0,
      count: 0,
    };
  }
}
