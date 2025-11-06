import { cascadeDeleteFromLinking } from '@/lib/viewer/cascade-delete-linking';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ error: string } | null>> {
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

    let etag: string | undefined;
    etag = request.headers.get('if-match') || undefined;
    if (!etag) {
      try {
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const body = (await request.json()) as { etag?: string };
          if (typeof body.etag === 'string') {
            etag = body.etag;
          }
        }
      } catch {}
    }

    if (!etag) {
      try {
        const getResponse = await fetch(annotationUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (!getResponse.ok) {
          const errorText = await getResponse
            .text()
            .catch(() => 'Unknown error');
          throw new Error(
            `Failed to fetch annotation: ${getResponse.status} ${getResponse.statusText} - ${errorText}`,
          );
        }
        etag = getResponse.headers.get('ETag') || undefined;
        if (!etag) {
          throw new Error('Annotation does not have an ETag');
        }
      } catch (fetchErr) {
        throw fetchErr;
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

    // Cascade deletion: Update or delete linking annotations that reference this annotation
    try {
      const cascadeResult = await cascadeDeleteFromLinking(
        [annotationUrl],
        authToken,
      );

      if (cascadeResult.affectedLinking > 0) {
        console.log(
          `Cascade deletion: ${cascadeResult.updated} linking annotations updated, ${cascadeResult.deleted} deleted`,
        );
      }

      if (cascadeResult.errors.length > 0) {
        console.error('Cascade deletion had errors:', cascadeResult.errors);
      }
    } catch (cascadeError) {
      // Log but don't fail the deletion - the main annotation was deleted successfully
      console.error('Error during cascade deletion:', cascadeError);
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error deleting annotation:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ error: string } | Record<string, unknown>>> {
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

    // Important: Do NOT set annotation-level creator for textspotting annotations
    // Human edits should be tracked at the body level, not annotation level
    const updatedAnnotation = {
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      ...body,
      modified: new Date().toISOString(),
    };

    const authToken = process.env.ANNO_REPO_TOKEN_JONA;
    if (!authToken) {
      throw new Error('AnnoRepo authentication token not configured');
    }

    const getResponse = await fetch(annotationUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text().catch(() => 'Unknown error');
      throw new Error(
        `Failed to fetch annotation: ${getResponse.status} ${getResponse.statusText} - ${errorText}`,
      );
    }

    const etag = getResponse.headers.get('ETag');
    if (!etag) {
      throw new Error('Annotation does not have an ETag');
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
      throw new Error(
        `AnnoRepo update failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error updating annotation:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
