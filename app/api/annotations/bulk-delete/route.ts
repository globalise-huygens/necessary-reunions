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

  return NextResponse.json({ results });
}
