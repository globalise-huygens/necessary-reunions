import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to delete annotations' },
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
    const debug = process.env.DEBUG_ANNOTATIONS_API === 'true';
    if (debug) {
      console.log(`[DEBUG] DELETE request for annotation: ${id}`);
      console.log(`[DEBUG] Decoded ID: ${decodedId}`);
      console.log(`[DEBUG] Final annotation URL: ${annotationUrl}`);
    }

    const authToken = process.env.ANNO_REPO_TOKEN_JONA;
    if (!authToken) {
      console.error('Missing authentication token');
      throw new Error('AnnoRepo authentication token not configured');
    }

    // First, get the current annotation to retrieve its ETag
    if (debug) console.log('[DEBUG] Fetching annotation to get ETag...');
    const getResponse = await fetch(annotationUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text().catch(() => 'Unknown error');
      if (debug) {
        console.error(
          '[DEBUG] Failed to fetch annotation for ETag:',
          getResponse.status,
          getResponse.statusText,
          errorText,
        );
      }
      throw new Error(
        `Failed to fetch annotation: ${getResponse.status} ${getResponse.statusText} - ${errorText}`,
      );
    }

    const etag = getResponse.headers.get('ETag');
    if (!etag) {
      if (debug) console.error('[DEBUG] No ETag found in annotation response');
      throw new Error('Annotation does not have an ETag');
    }

    if (debug) {
      console.log(`[DEBUG] Retrieved ETag: ${etag}`);
      console.log('[DEBUG] Making DELETE request to AnnoRepo...');
    }
    const response = await fetch(annotationUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'If-Match': etag,
      },
    });

    if (debug)
      console.log(
        `[DEBUG] AnnoRepo DELETE response status: ${response.status}`,
      );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (debug) {
        console.error(
          '[DEBUG] AnnoRepo delete error:',
          response.status,
          response.statusText,
          errorText,
        );
      }
      throw new Error(
        `AnnoRepo deletion failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    if (debug) console.log('[DEBUG] DELETE successful');
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    if (process.env.DEBUG_ANNOTATIONS_API === 'true') {
      console.error('[DEBUG] Error deleting annotation:', err);
      if (err && err.stack) console.error('[DEBUG] Error stack:', err.stack);
    }
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
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
    const debug = process.env.DEBUG_ANNOTATIONS_API === 'true';
    if (debug) {
      console.log(`[DEBUG] PUT request for annotation: ${id}`);
      console.log(`[DEBUG] Decoded ID: ${decodedId}`);
      console.log(`[DEBUG] Final annotation URL: ${annotationUrl}`);
    }

    const body = await request.json();
    if (debug)
      console.log(
        '[DEBUG] Request body received:',
        JSON.stringify(body, null, 2),
      );

    // Important: Do NOT set annotation-level creator for textspotting annotations
    // Human edits should be tracked at the body level, not annotation level
    const updatedAnnotation = {
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      ...body,
      modified: new Date().toISOString(),
    };

    if (debug)
      console.log(
        '[DEBUG] Updated annotation to send:',
        JSON.stringify(updatedAnnotation, null, 2),
      );

    const authToken = process.env.ANNO_REPO_TOKEN_JONA;
    if (!authToken) {
      console.error('Missing authentication token');
      throw new Error('AnnoRepo authentication token not configured');
    }

    // First, get the current annotation to retrieve its ETag
    if (debug) console.log('[DEBUG] Fetching annotation to get ETag...');
    const getResponse = await fetch(annotationUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text().catch(() => 'Unknown error');
      if (debug) {
        console.error(
          '[DEBUG] Failed to fetch annotation for ETag:',
          getResponse.status,
          getResponse.statusText,
          errorText,
        );
      }
      throw new Error(
        `Failed to fetch annotation: ${getResponse.status} ${getResponse.statusText} - ${errorText}`,
      );
    }

    const etag = getResponse.headers.get('ETag');
    if (!etag) {
      if (debug) console.error('[DEBUG] No ETag found in annotation response');
      throw new Error('Annotation does not have an ETag');
    }

    if (debug) {
      console.log(`[DEBUG] Retrieved ETag: ${etag}`);
      console.log('[DEBUG] Making PUT request to AnnoRepo...');
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

    if (debug)
      console.log(`[DEBUG] AnnoRepo PUT response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (debug) {
        console.error(
          '[DEBUG] AnnoRepo update error:',
          response.status,
          response.statusText,
          errorText,
        );
      }
      throw new Error(
        `AnnoRepo update failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();
    if (debug)
      console.log(
        '[DEBUG] PUT successful, result:',
        JSON.stringify(result, null, 2),
      );
    return NextResponse.json(result);
  } catch (err: any) {
    if (process.env.DEBUG_ANNOTATIONS_API === 'true') {
      console.error('[DEBUG] Error updating annotation:', err);
      if (err && err.stack) console.error('[DEBUG] Error stack:', err.stack);
    }
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
  }
}
