import type { Annotation } from '../types';

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
 * Direct client-side fallback when server-side proxy fails
 * (e.g., due to AnnoRepo firewall blocking Netlify IPs)
 */
async function fetchAnnotationsDirectly({
  targetCanvasId,
  page = 0,
}: {
  targetCanvasId: string;
  page?: number;
}): Promise<{
  items: Annotation[];
  hasMore: boolean;
}> {
  const encoded = encodeCanvasUri(targetCanvasId);
  const url = `https://annorepo.globalise.huygens.knaw.nl/services/necessary-reunions/custom-query/with-target:target=${encoded}`;
  const fullUrl = new URL(url);
  fullUrl.searchParams.set('page', page.toString());

  console.log('[AnnoRepo Direct] Fetching annotations from browser', {
    canvasId: targetCanvasId.substring(0, 80),
    page,
    url: fullUrl.toString().substring(0, 120),
  });

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

    console.log('[AnnoRepo Direct] Success', {
      itemsCount: items.length,
      hasMore,
      page,
    });

    return { items, hasMore };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[AnnoRepo Direct] Failed', {
      error: error instanceof Error ? error.message : String(error),
      page,
    });
    throw error;
  }
}

export async function fetchAnnotations({
  targetCanvasId,
  page = 0,
}: {
  targetCanvasId: string;
  page?: number;
}): Promise<{
  items: Annotation[];
  hasMore: boolean;
}> {
  const url = new URL('/api/annotations/external', getBaseUrl());
  url.searchParams.set('targetCanvasId', targetCanvasId);
  url.searchParams.set('page', page.toString());

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
      console.error('[SVG Debug] fetchAnnotations: API error', {
        status: res.status,
        statusText: res.statusText,
        error: errorData.error,
        page,
      });
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
      console.warn(
        '[fetchAnnotations] Server returned 0 items with error, trying direct access',
        {
          error: data.debug.error,
          errorCause: data.debug.errorCause,
        },
      );

      // Try direct browser → AnnoRepo access
      try {
        return await fetchAnnotationsDirectly({ targetCanvasId, page });
      } catch (directError) {
        console.error('[fetchAnnotations] Direct fallback also failed', {
          directError:
            directError instanceof Error
              ? directError.message
              : String(directError),
        });
        // Return server response even if empty
        return data;
      }
    }

    console.log('[SVG Debug] fetchAnnotations: API success', {
      itemsCount: data.items.length,
      hasMore: data.hasMore,
      page,
      url: url.pathname,
      debug: data.debug,
    });
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out after 10 seconds');
    }
    throw error;
  }
}

export async function deleteAnnotation(annotationUrl: string): Promise<void> {
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
): Promise<Annotation> {
  const url = new URL('/api/annotations', getBaseUrl());

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
