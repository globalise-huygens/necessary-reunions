import type { Annotation } from './types';
import { encodeCanvasUri } from './utils';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const QUERY_NAME = 'with-target';

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
  const encodedCanvas = encodeCanvasUri(targetCanvasId);
  const endpointCanvas = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/${QUERY_NAME}:target=${encodedCanvas}`;
  const urlCanvas = new URL(endpointCanvas);
  urlCanvas.searchParams.set('page', page.toString());

  const resCanvas = await fetch(urlCanvas.toString());
  if (!resCanvas.ok) {
    const txt = await resCanvas.text().catch(() => '[no body]');
    throw new Error(
      `Failed to fetch annotations: ${resCanvas.status} ${resCanvas.statusText}\n${txt}`,
    );
  }
  const dataCanvas = await resCanvas.json();
  let items: Annotation[] = Array.isArray(dataCanvas.items)
    ? dataCanvas.items
    : [];
  let hasMore = typeof dataCanvas.next === 'string';

  if (annotationIds && annotationIds.length > 0) {
    const BATCH_SIZE = 20;
    for (let i = 0; i < annotationIds.length; i += BATCH_SIZE) {
      const batch = annotationIds.slice(i, i + BATCH_SIZE);
      const geotagFetches = batch.map((annoId) => {
        const encodedAnno = encodeCanvasUri(annoId);
        const endpointAnno = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/${QUERY_NAME}:target=${encodedAnno}`;
        const urlAnno = new URL(endpointAnno);
        urlAnno.searchParams.set('page', '0');
        return fetch(urlAnno.toString())
          .then((resAnno) =>
            resAnno.ok ? resAnno.json() : Promise.resolve({ items: [] }),
          )
          .then((dataAnno) =>
            Array.isArray(dataAnno.items) ? dataAnno.items : [],
          );
      });
      const geotagResults = await Promise.all(geotagFetches);
      for (const geotagItems of geotagResults) {
        for (const item of geotagItems) {
          if (!items.some((i) => i.id === item.id)) {
            items.push(item);
          }
        }
      }
    }
  }

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
    if (!etag) {
      const headersObj: Record<string, string> = {};
      getRes.headers.forEach((value, key) => {
        headersObj[key] = value;
      });
      console.error(
        'No ETag header on annotation resource. Headers:',
        headersObj,
      );
      throw new Error(
        'Cannot delete annotation: No ETag header returned by the server. This may be a server configuration issue or the annotation is not deletable. See console for headers.',
      );
    }
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
  if (!etag) {
    const headersObj: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    console.warn(
      'fetchAnnotationWithEtag: No ETag header found. Headers:',
      headersObj,
    );
  }
  const data = await res.json();
  return { ...data, etag, id: data.id || annotationUrl };
}
