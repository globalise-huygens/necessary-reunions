import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to delete annotations' },
      { status: 401 },
    );
  }

  const debug = process.env.DEBUG_ANNOTATIONS_API === 'true';
  let body: { ids: string[]; etags?: Record<string, string> };
  try {
    body = await request.json();
  } catch (e) {
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

  // Helper to get ETag for an annotation with timeout
  async function fetchEtag(annotationUrl: string): Promise<string | undefined> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const res = await fetch(annotationUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${authToken}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) return undefined;
      return res.headers.get('ETag') || undefined;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error(
        `[bulk-delete] Failed to fetch ETag for ${annotationUrl}:`,
        error,
      );
      return undefined;
    }
  }

  // Helper to delete a single annotation
  async function deleteAnnotation(
    id: string,
    annotationUrl: string,
    etag: string,
  ) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const res = await fetch(annotationUrl, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'If-Match': etag,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return { id, success: true };
      } else {
        const errorText = await res.text().catch(() => 'Unknown error');
        return { id, success: false, error: errorText };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error(`[bulk-delete] Failed to delete ${id}:`, error);
      return { id, success: false, error: 'Request timeout or network error' };
    }
  }

  // Process deletions with concurrency limit
  async function processWithConcurrency<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrency: number = 5,
  ): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map(processor));
      results.push(...batchResults);
    }
    return results;
  }

  // Prepare annotation URLs
  const annotationItems = ids.map((id) => {
    const decodedId = decodeURIComponent(id);
    const annotationUrl = decodedId.startsWith('https://')
      ? decodedId
      : `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}/${encodeURIComponent(
          decodedId,
        )}`;
    return { id, url: annotationUrl, etag: etags[id] };
  });

  // First, fetch missing ETags in parallel with concurrency limit
  const itemsWithEtags = await processWithConcurrency(
    annotationItems,
    async (item) => {
      if (item.etag) {
        return item;
      }
      const etag = await fetchEtag(item.url);
      return { ...item, etag };
    },
    10, // Higher concurrency for GET requests
  );

  // Filter out items without ETags and delete in parallel with concurrency limit
  const validItems = itemsWithEtags.filter((item) => item.etag);
  const invalidItems = itemsWithEtags.filter((item) => !item.etag);

  const deleteResults = await processWithConcurrency(
    validItems,
    async (item) => deleteAnnotation(item.id, item.url, item.etag!),
    5, // Lower concurrency for DELETE requests
  );

  // Add results for items without ETags
  const invalidResults = invalidItems.map((item) => ({
    id: item.id,
    success: false,
    error: 'No ETag found for annotation',
  }));

  const results = [...deleteResults, ...invalidResults];

  return NextResponse.json({ results });
}
