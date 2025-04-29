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

  console.log('Annorepo fetch ▶', url.toString());

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

  console.log(
    `Annorepo returned ${items.length} items (page ${page}), hasMore=${hasMore}`,
  );

  return { items, hasMore };
}
