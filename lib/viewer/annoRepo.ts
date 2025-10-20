import type { Annotation } from '../types';

function getBaseUrl(): string {
  return typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXTAUTH_URL || 'http://localhost:3000';
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
      throw new Error(
        `Failed to fetch annotations: ${res.status} ${res.statusText}\n${
          errorData.error || 'Unknown error'
        }`,
      );
    }

    const data = (await res.json()) as {
      items: Annotation[];
      hasMore: boolean;
    };
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
