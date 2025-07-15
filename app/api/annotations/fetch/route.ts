import { NextRequest, NextResponse } from 'next/server';

// Indicate that this route should not be statically generated
export const dynamic = 'force-dynamic';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const QUERY_NAME = 'with-target';

function encodeCanvasUri(uri: string): string {
  return encodeURIComponent(Buffer.from(uri, 'utf8').toString('base64'));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetCanvasId = searchParams.get('targetCanvasId');
    const page = parseInt(searchParams.get('page') || '0');
    const annotationIds = searchParams.get('annotationIds');

    if (!targetCanvasId) {
      return NextResponse.json(
        { error: 'targetCanvasId is required' },
        { status: 400 },
      );
    }

    const encodedCanvas = encodeCanvasUri(targetCanvasId);
    const endpointCanvas = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/${QUERY_NAME}:target=${encodedCanvas}`;
    const urlCanvas = new URL(endpointCanvas);
    urlCanvas.searchParams.set('page', page.toString());

    const resCanvas = await fetch(urlCanvas.toString());
    if (!resCanvas.ok) {
      const txt = await resCanvas.text().catch(() => '[no body]');
      return NextResponse.json(
        {
          error: `Failed to fetch annotations: ${resCanvas.status} ${resCanvas.statusText}`,
          details: txt,
        },
        { status: resCanvas.status },
      );
    }

    const dataCanvas = await resCanvas.json();
    let items = Array.isArray(dataCanvas.items) ? dataCanvas.items : [];
    let hasMore = typeof dataCanvas.next === 'string';

    const linkingAnnotations = items.filter(
      (item: any) => item.motivation === 'linking',
    );

    const pointSelectorsFound = linkingAnnotations.filter((annotation: any) =>
      annotation.body?.find(
        (b: any) =>
          b.purpose === 'identifying' &&
          b.selector &&
          b.selector.type === 'PointSelector',
      ),
    );

    if (annotationIds) {
      const ids = annotationIds.split(',').filter(Boolean);

      if (ids.length > 100) {
        ids.splice(100);
      }

      if (ids.length > 0) {
        const BATCH_SIZE = 20;
        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
          const batch = ids.slice(i, i + BATCH_SIZE);
          const geotagFetches = batch.map(async (annoId) => {
            const encodedAnno = encodeCanvasUri(annoId);
            const endpointAnno = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/${QUERY_NAME}:target=${encodedAnno}`;
            const urlAnno = new URL(endpointAnno);
            urlAnno.searchParams.set('page', '0');

            try {
              const resAnno = await fetch(urlAnno.toString());
              if (resAnno.ok) {
                const dataAnno = await resAnno.json();
                const items = Array.isArray(dataAnno.items)
                  ? dataAnno.items
                  : [];
                return items;
              }
            } catch (err) {}
            return [];
          });

          const geotagResults = await Promise.all(geotagFetches);
          for (const geotagItems of geotagResults) {
            for (const item of geotagItems) {
              if (!items.some((i: any) => i.id === item.id)) {
                items.push(item);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      items,
      hasMore,
      totalFetched: items.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 },
    );
  }
}
