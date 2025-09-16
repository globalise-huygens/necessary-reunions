import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

// ETag cache to avoid redundant fetches
const etagCache = new Map<string, { etag: string; timestamp: number }>();
const ETAG_CACHE_DURATION = 30000; // 30 seconds

async function getOrFetchETag(
  annotationUrl: string,
  authToken: string,
): Promise<string | undefined> {
  const cached = etagCache.get(annotationUrl);
  const now = Date.now();

  // Use cached ETag if recent
  if (cached && now - cached.timestamp < ETAG_CACHE_DURATION) {
    return cached.etag;
  }

  try {
    const response = await fetch(annotationUrl, {
      method: 'HEAD', // Use HEAD instead of GET - much faster!
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      return undefined;
    }

    const etag = response.headers.get('ETag');
    if (etag) {
      etagCache.set(annotationUrl, { etag, timestamp: now });
    }

    return etag || undefined;
  } catch (error) {
    console.warn('Failed to fetch ETag:', error);
    return undefined;
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to update annotations' },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  let annotationUrl: string;
  const decodedId = decodeURIComponent(id);

  if (decodedId.startsWith('https://')) {
    annotationUrl = decodedId;
  } else {
    annotationUrl = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}/${encodeURIComponent(
      decodedId,
    )}`;
  }

  try {
    const body = await request.json();

    const updatedAnnotation = {
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      ...body,
      modified: new Date().toISOString(),
    };

    const authToken = process.env.ANNO_REPO_TOKEN_JONA;
    if (!authToken) {
      throw new Error('AnnoRepo authentication token not configured');
    }

    // Try client-provided ETag first, then fetch if needed
    let etag: string | undefined = request.headers.get('if-match') || undefined;

    if (!etag && body.etag) {
      etag = body.etag;
    }

    if (!etag) {
      etag = await getOrFetchETag(annotationUrl, authToken);
      if (!etag) {
        throw new Error('Could not retrieve annotation ETag');
      }
    }

    const response = await fetch(annotationUrl, {
      method: 'PUT',
      headers: {
        'Content-Type':
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        Authorization: `Bearer ${authToken}`,
        'If-Match': etag,
      },
      body: JSON.stringify(updatedAnnotation),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');

      // Clear ETag cache on conflict - annotation may have changed
      if (response.status === 412) {
        etagCache.delete(annotationUrl);
      }

      throw new Error(
        `AnnoRepo update failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();

    // Update ETag cache with new value
    const newETag = response.headers.get('ETag');
    if (newETag) {
      etagCache.set(annotationUrl, { etag: newETag, timestamp: Date.now() });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error updating annotation:', err.message || err);
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const decodedId = decodeURIComponent(id);
  let annotationUrl: string;
  if (decodedId.startsWith('https://')) {
    annotationUrl = decodedId;
  } else {
    annotationUrl = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}/${encodeURIComponent(
      decodedId,
    )}`;
  }

  try {
    const authToken = process.env.ANNO_REPO_TOKEN_JONA;
    if (!authToken) {
      throw new Error('AnnoRepo authentication token not configured');
    }

    // Try to get ETag from client first
    let etag: string | undefined = request.headers.get('if-match') || undefined;

    if (!etag) {
      try {
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const body = await request.json();
          if (body && typeof body.etag === 'string') {
            etag = body.etag;
          }
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
    }

    // If no ETag provided, fetch it efficiently
    if (!etag) {
      etag = await getOrFetchETag(annotationUrl, authToken);
      if (!etag) {
        throw new Error('Could not retrieve annotation ETag for deletion');
      }
    }

    const deleteHeaders: Record<string, string> = {
      Authorization: `Bearer ${authToken}`,
    };
    if (etag) deleteHeaders['If-Match'] = etag;

    const deleteResponse = await fetch(annotationUrl, {
      method: 'DELETE',
      headers: deleteHeaders,
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse
        .text()
        .catch(() => 'Unknown error');
      throw new Error(
        `AnnoRepo deletion failed: ${deleteResponse.status} ${deleteResponse.statusText} - ${errorText}`,
      );
    }

    // Clear from ETag cache
    etagCache.delete(annotationUrl);

    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error('Error deleting annotation:', err.message || err);
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
  }
}
