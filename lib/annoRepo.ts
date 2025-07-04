import type { Annotation } from './types';
import { encodeCanvasUri } from './utils';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const QUERY_NAME = 'with-target';

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
  const encoded = encodeCanvasUri(targetCanvasId);

  const endpoint = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/${QUERY_NAME}:target=${encoded}`;
  const url = new URL(endpoint);
  url.searchParams.set('page', page.toString());

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text().catch(() => '[no body]');
    throw new Error(
      `Failed to fetch annotations: ${res.status} ${res.statusText}\n${txt}`,
    );
  }

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];

  const hasMore = typeof data.next === 'string';

  return { items, hasMore };
}

const AUTH_HEADER = {
  Authorization: `Bearer ${process.env.ANNO_REPO_TOKEN_JONA}`,
};

export async function deleteAnnotation(annotationUrl: string): Promise<void> {
  let etag: string | null = null;
  const headRes = await fetch(annotationUrl, {
    method: 'HEAD',
    headers: {
      ...AUTH_HEADER,
      Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
    },
  });
  if (headRes.ok) {
    etag = headRes.headers.get('etag');
  }

  if (!etag) {
    const getRes = await fetch(annotationUrl, {
      method: 'GET',
      headers: {
        ...AUTH_HEADER,
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      },
    });
    if (!getRes.ok) {
      throw new Error(`Failed to fetch annotation for ETag: ${getRes.status}`);
    }
    etag = getRes.headers.get('etag');
  }

  if (!etag) {
    throw new Error('No ETag header on annotation resource');
  }

  const delRes = await fetch(annotationUrl, {
    method: 'DELETE',
    headers: {
      ...AUTH_HEADER,
      'If-Match': etag,
    },
  });
  if (!delRes.ok) {
    throw new Error(`Delete failed: ${delRes.status} ${delRes.statusText}`);
  }
}

export async function updateAnnotation(
  annotationUrl: string,
  annotation: Annotation,
): Promise<Annotation> {
  let etag: string | null = null;
  const headRes = await fetch(annotationUrl, {
    method: 'HEAD',
    headers: {
      ...AUTH_HEADER,
      Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
    },
  });
  if (headRes.ok) {
    etag = headRes.headers.get('etag');
  }

  if (!etag) {
    const getRes = await fetch(annotationUrl, {
      method: 'GET',
      headers: {
        ...AUTH_HEADER,
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      },
    });
    if (!getRes.ok) {
      throw new Error(`Failed to fetch annotation for ETag: ${getRes.status}`);
    }
    etag = getRes.headers.get('etag');
  }

  if (!etag) {
    throw new Error('No ETag header on annotation resource');
  }

  const putRes = await fetch(annotationUrl, {
    method: 'PUT',
    headers: {
      ...AUTH_HEADER,
      'If-Match': etag,
      'Content-Type':
        'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
    },
    body: JSON.stringify(annotation),
  });

  if (!putRes.ok) {
    const txt = await putRes.text().catch(() => '[no body]');
    throw new Error(
      `Update failed: ${putRes.status} ${putRes.statusText}\n${txt}`,
    );
  }

  return await putRes.json();
}

export async function createAnnotation(
  annotation: Annotation,
): Promise<Annotation> {
  const url = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...AUTH_HEADER,
      'Content-Type':
        'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
    },
    body: JSON.stringify(annotation),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '[no body]');
    throw new Error(
      `Failed to create annotation: ${res.status} ${res.statusText}\n${txt}`,
    );
  }

  return await res.json();
}
