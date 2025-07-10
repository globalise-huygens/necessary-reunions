import type { Annotation } from './types';

export async function fetchAnnotations({
  targetCanvasId,
  annotationIds = [],
  page = 0,
}: {
  targetCanvasId: string;
  annotationIds?: string[];
  page?: number;
}): Promise<{
  items: Annotation[];
  hasMore: boolean;
}> {
  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXTAUTH_URL || 'http://localhost:3001';

  const url = new URL('/api/annotations/fetch', baseUrl);
  url.searchParams.set('targetCanvasId', targetCanvasId);
  url.searchParams.set('page', page.toString());

  if (annotationIds && annotationIds.length > 0) {
    const maxIds = 50;
    if (annotationIds.length > maxIds) {
      annotationIds = annotationIds.slice(0, maxIds);
    }
    url.searchParams.set('annotationIds', annotationIds.join(','));
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText };
    }
    throw new Error(
      `Failed to fetch annotations: ${response.status} ${
        response.statusText
      } - ${errorData.error || errorText}`,
    );
  }

  const data = await response.json();

  return {
    items: data.items || [],
    hasMore: data.hasMore || false,
  };
}

const AUTH_HEADER = {
  Authorization: `Bearer ${process.env.ANNO_REPO_TOKEN_JONA}`,
};

export async function deleteAnnotation(
  annotationUrl: string,
  providedEtag?: string,
): Promise<void> {
  const token = process.env.ANNO_REPO_TOKEN_GLOBALISE;
  if (!token) throw new Error('No ANNO_REPO_TOKEN_GLOBALISE set');

  const AUTH_HEADER_DELETE = {
    Authorization: `Bearer ${token}`,
  };

  let etag: string | null = providedEtag || null;

  // Only fetch ETag if not provided
  if (!etag) {
    const headRes = await fetch(annotationUrl, {
      method: 'HEAD',
      headers: {
        ...AUTH_HEADER_DELETE,
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      },
    });
    if (headRes.ok) {
      etag = headRes.headers.get('etag');
    }

    if (!etag) {
      const getRes = await fetch(annotationUrl, {
        method: 'GET',
        headers: {
          ...AUTH_HEADER_DELETE,
          Accept:
            'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        },
      });
      if (!getRes.ok) {
        throw new Error(
          `Failed to fetch annotation for ETag: ${getRes.status}`,
        );
      }
      etag = getRes.headers.get('etag');
      if (!etag) {
        throw new Error(
          'Cannot delete annotation: No ETag header returned by the server. This may be a server configuration issue or the annotation is not deletable.',
        );
      }
    }
  }

  const delRes = await fetch(annotationUrl, {
    method: 'DELETE',
    headers: {
      ...AUTH_HEADER_DELETE,
      'If-Match': etag,
    },
  });
  if (!delRes.ok) {
    const errorText = await delRes.text().catch(() => 'Unknown error');
    throw new Error(
      `Delete failed: ${delRes.status} ${delRes.statusText} - ${errorText}`,
    );
  }
}

export async function updateAnnotation(
  annotationUrl: string,
  annotation: any,
  etag: string,
): Promise<{ annotation: any; etag: string }> {
  const token = process.env.ANNO_REPO_TOKEN_GLOBALISE;
  if (!token) throw new Error('No ANNO_REPO_TOKEN_GLOBALISE set');

  const res = await fetch(annotationUrl, {
    method: 'PUT',
    headers: {
      'Content-Type':
        'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      Authorization: `Bearer ${token}`,
      'If-Match': etag,
    },
    body: JSON.stringify(annotation),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '[no body]');
    throw new Error(
      `Failed to update annotation: ${res.status} ${res.statusText}\n${txt}`,
    );
  }

  const newEtag = res.headers.get('etag') || '';
  const updatedAnnotation = await res.json();

  return {
    annotation: updatedAnnotation,
    etag: newEtag,
  };
}

export async function createAnnotation(annotation: any) {
  const token = process.env.ANNO_REPO_TOKEN_GLOBALISE;
  if (!token) throw new Error('No ANNO_REPO_TOKEN_GLOBALISE set');
  const res = await fetch(
    'https://annorepo.globalise.huygens.knaw.nl/services/necessary-reunions/annotations-batch',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(
        Array.isArray(annotation) ? annotation : [annotation],
      ),
    },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => '[no body]');
    throw new Error(
      `Failed to post annotation: ${res.status} ${res.statusText}\n${txt}`,
    );
  }
  return await res.json();
}

export async function fetchAnnotationWithEtag(annotationUrl: string) {
  const res = await fetch(annotationUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch annotation: ${res.status}`);
  const etag = res.headers.get('etag');
  const data = await res.json();
  return { ...data, etag, id: data.id || annotationUrl };
}

export async function updateAnnotationClient(
  annotationId: string,
  annotation: any,
  etag: string,
): Promise<{ annotation: any; etag: string }> {
  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXTAUTH_URL || 'http://localhost:3001';

  const response = await fetch(
    `${baseUrl}/api/annotations/${encodeURIComponent(annotationId)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type':
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        'If-Match': etag,
      },
      body: JSON.stringify(annotation),
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText };
    }
    throw new Error(
      `Failed to update annotation: ${response.status} ${
        response.statusText
      } - ${errorData.error || errorText}`,
    );
  }

  const data = await response.json();
  return {
    annotation: data,
    etag: data.etag,
  };
}
