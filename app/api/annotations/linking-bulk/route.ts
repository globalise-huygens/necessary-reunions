import { encodeCanvasUri } from '@/lib/shared/utils';
import { NextRequest, NextResponse } from 'next/server';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const QUERY_NAME = 'with-target-and-motivation-or-purpose';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetCanvasId = searchParams.get('targetCanvasId');

  if (!targetCanvasId) {
    return NextResponse.json(
      { error: 'targetCanvasId is required' },
      { status: 400 },
    );
  }

  try {
    const encoded = encodeCanvasUri(targetCanvasId);
    // Use the custom query to get all linking annotations at once
    const motivationOrPurpose = Buffer.from('linking').toString('base64');
    const endpoint = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/${QUERY_NAME}:target=${encoded},motivationorpurpose=${motivationOrPurpose}`;

    const authToken = process.env.ANNO_REPO_TOKEN_JONA;
    const headers: HeadersInit = {
      Accept: 'application/json',
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const res = await fetch(endpoint, { headers });

    if (!res.ok) {
      const txt = await res.text().catch(() => '[no body]');
      console.error(
        `Bulk linking API error: ${res.status} ${res.statusText}\n${txt}`,
      );
      return NextResponse.json(
        {
          error: `Failed to fetch linking annotations: ${res.status} ${res.statusText}`,
          details: txt,
        },
        { status: res.status },
      );
    }

    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];

    // Process linking annotations to extract icon states quickly
    const iconStates: Record<
      string,
      { hasGeotag: boolean; hasPoint: boolean; isLinked: boolean }
    > = {};

    items.forEach((linkingAnnotation: any) => {
      if (
        linkingAnnotation.motivation === 'linking' &&
        linkingAnnotation.target
      ) {
        const targets = Array.isArray(linkingAnnotation.target)
          ? linkingAnnotation.target
          : [linkingAnnotation.target];

        // Extract purposes from body
        const body = Array.isArray(linkingAnnotation.body)
          ? linkingAnnotation.body
          : [linkingAnnotation.body];

        const hasGeotag = body.some((b: any) => b.purpose === 'geotagging');
        const hasPoint = body.some((b: any) => b.purpose === 'selecting');
        const isLinked = targets.length > 1;

        // Mark all target annotations with their icon states
        targets.forEach((target: string) => {
          iconStates[target] = {
            hasGeotag: iconStates[target]?.hasGeotag || hasGeotag,
            hasPoint: iconStates[target]?.hasPoint || hasPoint,
            isLinked: iconStates[target]?.isLinked || isLinked,
          };
        });
      }
    });

    return NextResponse.json({
      annotations: items,
      iconStates,
    });
  } catch (error) {
    console.error('Error fetching bulk linking annotations:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
