import {
  canEditProject,
  resolveAnnoRepoConfig,
} from '@/lib/shared/annorepo-config';
import { getAuthFromRequest } from '@/lib/shared/auth';
import { cascadeDeleteFromLinking } from '@/lib/viewer/cascade-delete-linking';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Fetch with a timeout to prevent hanging in serverless environments. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ error: string } | null>> {
  console.error('[annotations/DELETE] invoked:', request.method, request.url);
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to delete annotations' },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const decodedId = decodeURIComponent(id);
  const url = new URL(request.url);
  const project = url.searchParams.get('project');
  const { baseUrl, container, authToken } = resolveAnnoRepoConfig(project);

  // Per-project ORCID authorization
  const userOrcid = auth.user.id;
  if (!canEditProject(userOrcid, project)) {
    return NextResponse.json(
      { error: 'Forbidden – you are not authorised to edit this project' },
      { status: 403 },
    );
  }

  let annotationUrl: string;
  if (decodedId.startsWith('https://')) {
    annotationUrl = decodedId;
  } else {
    annotationUrl = `${baseUrl}/w3c/${container}/${encodeURIComponent(
      decodedId,
    )}`;
  }

  try {
    if (!authToken) {
      return NextResponse.json(
        {
          error: 'AnnoRepo authentication token not configured',
          cause: 'config',
        },
        { status: 502 },
      );
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
        const getResponse = await fetchWithTimeout(annotationUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (!getResponse.ok) {
          const errorText = await getResponse
            .text()
            .catch(() => 'Unknown error');
          return NextResponse.json(
            {
              error: `Failed to fetch annotation for ETag: ${getResponse.status} ${getResponse.statusText}`,
              cause: 'annorepo-get',
              upstream: errorText.slice(0, 200),
            },
            { status: 502 },
          );
        }
        etag = getResponse.headers.get('ETag') || undefined;
        if (!etag) {
          return NextResponse.json(
            {
              error: 'Annotation does not have an ETag',
              cause: 'annorepo-etag',
            },
            { status: 502 },
          );
        }
      } catch (fetchErr) {
        const msg = fetchErr instanceof Error ? fetchErr.message : 'Unknown';
        return NextResponse.json(
          { error: `AnnoRepo unreachable: ${msg}`, cause: 'annorepo-timeout' },
          { status: 504 },
        );
      }
    }

    const deleteHeaders: Record<string, string> = {
      Authorization: `Bearer ${authToken}`,
    };
    if (etag) deleteHeaders['If-Match'] = etag;

    const deleteResponse = await fetchWithTimeout(annotationUrl, {
      method: 'DELETE',
      headers: deleteHeaders,
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse
        .text()
        .catch(() => 'Unknown error');
      return NextResponse.json(
        {
          error: `AnnoRepo deletion failed: ${deleteResponse.status} ${deleteResponse.statusText}`,
          cause: 'annorepo-delete',
          upstream: errorText.slice(0, 200),
        },
        { status: 502 },
      );
    }

    try {
      const cascadeResult = await cascadeDeleteFromLinking(
        [annotationUrl],
        authToken,
        project || undefined,
      );

      if (cascadeResult.errors.length > 0) {
        console.error('Cascade deletion had errors:', cascadeResult.errors);
      }
    } catch (cascadeError) {
      console.error('Error during cascade deletion:', cascadeError);
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    console.error('Error deleting annotation:', errorMessage);
    return NextResponse.json(
      {
        error: isAbort ? 'AnnoRepo request timed out' : errorMessage,
        cause: isAbort ? 'timeout' : 'unexpected',
      },
      { status: isAbort ? 504 : 500 },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ error: string } | Record<string, unknown>>> {
  console.error('[annotations/PUT] invoked:', request.method, request.url);
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to update annotations' },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  let annotationUrl: string;
  const decodedId = decodeURIComponent(id);
  const url = new URL(request.url);
  const project = url.searchParams.get('project');
  const {
    baseUrl,
    container,
    authToken: projectAuthToken,
  } = resolveAnnoRepoConfig(project);

  // Per-project ORCID authorization
  const userOrcid = auth.user.id;
  if (!canEditProject(userOrcid, project)) {
    return NextResponse.json(
      { error: 'Forbidden – you are not authorised to edit this project' },
      { status: 403 },
    );
  }

  if (decodedId.startsWith('https://')) {
    annotationUrl = decodedId;
  } else {
    annotationUrl = `${baseUrl}/w3c/${container}/${encodeURIComponent(
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

    const authToken = projectAuthToken;
    if (!authToken) {
      return NextResponse.json(
        {
          error: 'AnnoRepo authentication token not configured',
          cause: 'config',
        },
        { status: 502 },
      );
    }

    const getResponse = await fetchWithTimeout(annotationUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text().catch(() => 'Unknown error');
      return NextResponse.json(
        {
          error: `Failed to fetch annotation for ETag: ${getResponse.status} ${getResponse.statusText}`,
          cause: 'annorepo-get',
          upstream: errorText.slice(0, 200),
        },
        { status: 502 },
      );
    }

    const etag = getResponse.headers.get('ETag');
    if (!etag) {
      return NextResponse.json(
        { error: 'Annotation does not have an ETag', cause: 'annorepo-etag' },
        { status: 502 },
      );
    }

    const response = await fetchWithTimeout(annotationUrl, {
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
      return NextResponse.json(
        {
          error: `AnnoRepo update failed: ${response.status} ${response.statusText}`,
          cause: 'annorepo-put',
          upstream: errorText.slice(0, 200),
        },
        { status: 502 },
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    console.error('Error updating annotation:', errorMessage);
    return NextResponse.json(
      {
        error: isAbort ? 'AnnoRepo request timed out' : errorMessage,
        cause: isAbort ? 'timeout' : 'unexpected',
      },
      { status: isAbort ? 504 : 500 },
    );
  }
}
