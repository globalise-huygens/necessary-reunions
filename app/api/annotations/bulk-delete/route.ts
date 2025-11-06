import { cascadeDeleteFromLinking } from '@/lib/viewer/cascade-delete-linking';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

export async function POST(
  request: Request,
): Promise<
  NextResponse<{ error: string } | { results: Array<Record<string, unknown>> }>
> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to delete annotations' },
      { status: 401 },
    );
  }

  let body: { ids: string[]; etags?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { ids, etags = {} } = body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: 'No annotation IDs provided' },
      { status: 400 },
    );
  }

  const authToken = process.env.ANNO_REPO_TOKEN_JONA;
  if (!authToken) {
    return NextResponse.json(
      { error: 'AnnoRepo authentication token not configured' },
      { status: 500 },
    );
  }

  async function fetchEtag(annotationUrl: string): Promise<string | undefined> {
    const res = await fetch(annotationUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) return undefined;
    return res.headers.get('ETag') || undefined;
  }

  const results = await Promise.all(
    ids.map(async (id) => {
      const decodedId = decodeURIComponent(id);
      const annotationUrl = decodedId.startsWith('https://')
        ? decodedId
        : `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}/${encodeURIComponent(
            decodedId,
          )}`;
      let etag: string | undefined = etags[id];
      if (!etag) {
        etag = await fetchEtag(annotationUrl);
        if (!etag) {
          console.error(`[bulk-delete] No ETag found for annotation ${id}`);
          return {
            id,
            success: false,
            error: 'No ETag found for annotation',
          };
        }
      }
      if (!etag) {
        return { id, success: false, error: 'No ETag found' };
      }
      const headers: Record<string, string> = {
        Authorization: `Bearer ${authToken}`,
      };
      if (etag) headers['If-Match'] = etag;
      const res = await fetch(annotationUrl, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        return { id, success: true };
      } else {
        const errorText = await res.text().catch(() => 'Unknown error');
        return { id, success: false, error: errorText };
      }
    }),
  );

  // Cascade deletion: Update or delete linking annotations for all successfully deleted annotations
  const successfulDeletes = results
    .filter((r) => r.success)
    .map((r) => {
      const decodedId = decodeURIComponent(r.id);
      return decodedId.startsWith('https://')
        ? decodedId
        : `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}/${encodeURIComponent(
            decodedId,
          )}`;
    });

  if (successfulDeletes.length > 0) {
    try {
      const cascadeResult = await cascadeDeleteFromLinking(
        successfulDeletes,
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
      // Log but don't fail the bulk delete - annotations were deleted successfully
      console.error('Error during cascade deletion:', cascadeError);
    }
  }

  return NextResponse.json({ results });
}
