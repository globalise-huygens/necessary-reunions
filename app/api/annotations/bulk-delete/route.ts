import { cascadeDeleteFromLinking } from '@/lib/viewer/cascade-delete-linking';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import {
  resolveAnnoRepoConfig,
  canEditProject,
} from '@/lib/shared/annorepo-config';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

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

  let body: { ids: string[]; etags?: Record<string, string>; project?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { ids, etags = {}, project: projectSlug } = body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: 'No annotation IDs provided' },
      { status: 400 },
    );
  }

  // Per-project ORCID authorization
  const userOrcid = (session.user as { id?: string })?.id;
  if (!canEditProject(userOrcid, projectSlug)) {
    return NextResponse.json(
      { error: 'Forbidden – you are not authorised to edit this project' },
      { status: 403 },
    );
  }

  const { baseUrl, container, authToken } = resolveAnnoRepoConfig(projectSlug);
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
        : `${baseUrl}/w3c/${container}/${encodeURIComponent(decodedId)}`;
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
        project || undefined,
      );

      if (cascadeResult.errors.length > 0) {
        console.error('Cascade deletion had errors:', cascadeResult.errors);
      }
    } catch (cascadeError) {
      console.error('Error during cascade deletion:', cascadeError);
    }
  }

  return NextResponse.json({ results });
}
