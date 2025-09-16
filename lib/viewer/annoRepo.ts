import type { Annotation } from '../types';

// Helper function to get the base URL for both client and server contexts
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
  // Use our internal API route which handles authentication
  const url = new URL('/api/annotations/external', getBaseUrl());
  url.searchParams.set('targetCanvasId', targetCanvasId);
  url.searchParams.set('page', page.toString());

  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 15000); // Increased timeout to 15 seconds

  // Retry logic for network failures
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        // Add cache busting for fresh data
        cache: 'no-cache',
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ error: 'Unknown error' }));

        // Don't retry 4xx errors (client errors)
        if (res.status >= 400 && res.status < 500) {
          throw new Error(
            `Failed to fetch annotations: ${res.status} ${res.statusText}\n${
              errorData.error || 'Unknown error'
            }`,
          );
        }

        // Retry 5xx errors (server errors)
        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, 500 * (attempt + 1)),
          );
          continue;
        }

        throw new Error(
          `Failed to fetch annotations: ${res.status} ${res.statusText}\n${
            errorData.error || 'Unknown error'
          }`,
        );
      }

      const data = await res.json();
      return data;
    } catch (error) {
      lastError = error as Error;

      // Don't retry abort errors or client errors
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('400'))
      ) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timed out after 15 seconds');
        }
        throw error;
      }

      // Retry network errors
      if (attempt < maxRetries) {
        console.warn(`Fetch attempt ${attempt + 1} failed, retrying...`, error);
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (attempt + 1)),
        );
        continue;
      }
    }
  }

  clearTimeout(timeoutId);
  throw lastError || new Error('Failed to fetch annotations after retries');
}

export async function deleteAnnotation(annotationUrl: string): Promise<void> {
  // Extract annotation ID from URL
  const annotationId = annotationUrl.includes('/')
    ? annotationUrl.split('/').pop()
    : annotationUrl;

  if (!annotationId) {
    throw new Error('Invalid annotation URL or ID');
  }

  // Use the existing dynamic route which now handles AnnoRepo calls
  const url = new URL(
    `/api/annotations/${encodeURIComponent(annotationId)}`,
    getBaseUrl(),
  );

  const response = await fetch(url.toString(), { method: 'DELETE' });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `Delete failed: ${response.status}`);
  }
}

export async function updateAnnotation(
  annotationUrl: string,
  annotation: Annotation,
): Promise<Annotation> {
  // Extract annotation ID from URL
  const annotationId = annotationUrl.includes('/')
    ? annotationUrl.split('/').pop()
    : annotationUrl;

  if (!annotationId) {
    throw new Error('Invalid annotation URL or ID');
  }

  // Use the existing dynamic route which now handles AnnoRepo calls
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
    const errorData = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `Update failed: ${response.status}`);
  }

  return await response.json();
}

export async function createAnnotation(
  annotation: Annotation,
): Promise<Annotation> {
  // Use our internal API route which now handles AnnoRepo calls
  const url = new URL('/api/annotations', getBaseUrl());

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(annotation),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `Create failed: ${response.status}`);
  }

  return await response.json();
}
