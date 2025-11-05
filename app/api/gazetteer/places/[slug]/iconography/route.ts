import { NextResponse } from 'next/server';

export const runtime = 'edge';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const REQUEST_TIMEOUT = 2000;

interface IconographyClassification {
  label: string;
  id: string;
  creator?: {
    id: string;
    type: string;
    label: string;
  };
  created?: string;
}

async function fetchTargetAnnotation(
  targetId: string,
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(targetId, {
      headers: {
        Accept: '*/*',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as Record<string, unknown>;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  try {
    const { slug } = await context.params;

    // First, get the linking annotation for this place
    const searchUrl = `${ANNOREPO_BASE_URL}/services/necessary-reunions/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(searchUrl, {
      headers: {
        Accept: '*/*',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({ classifications: [] });
    }

    const result = (await response.json()) as {
      items?: Array<{
        id: string;
        target: string | string[];
        body?: any;
      }>;
    };

    const annotations = result.items || [];

    // Find annotations for this place (match by slug in geotag body)
    const matchingAnnotations = annotations.filter((ann) => {
      const bodies = Array.isArray(ann.body)
        ? ann.body
        : ann.body
          ? [ann.body]
          : [];

      const geotagBody = bodies.find((b: any) => b.purpose === 'geotagging');
      if (geotagBody?.source) {
        const placeName = (
          geotagBody.source.preferredTerm ||
          geotagBody.source.label ||
          ''
        )
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        return placeName === slug;
      }
      return false;
    });

    if (matchingAnnotations.length === 0) {
      return NextResponse.json({ classifications: [] });
    }

    // Get all target IDs from matching linking annotations
    const allTargetIds = new Set<string>();
    matchingAnnotations.forEach((ann) => {
      if (Array.isArray(ann.target)) {
        ann.target.forEach((t) => {
          if (typeof t === 'string') allTargetIds.add(t);
        });
      }
    });

    // Fetch up to 30 target annotations in parallel, looking for iconography
    const targetIds = Array.from(allTargetIds).slice(0, 30);
    const results = await Promise.allSettled(
      targetIds.map((id) => fetchTargetAnnotation(id)),
    );

    const classifications: IconographyClassification[] = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        const annotation = result.value;
        const isIconography =
          annotation.motivation === 'iconography' ||
          annotation.motivation === 'iconograpy';

        if (isIconography) {
          const bodies = Array.isArray(annotation.body)
            ? annotation.body
            : annotation.body
              ? [annotation.body]
              : [];

          bodies.forEach((body: any) => {
            if (body.purpose === 'classifying' && body.source?.label) {
              classifications.push({
                label: body.source.label,
                id: body.source.id || '',
                creator: body.creator
                  ? {
                      id: body.creator.id || '',
                      type: body.creator.type || 'Person',
                      label: body.creator.label || '',
                    }
                  : undefined,
                created: body.created,
              });
            }
          });
        }
      }
    });

    return NextResponse.json({ classifications });
  } catch (error) {
    console.error('Error fetching iconography:', error);
    return NextResponse.json({ classifications: [] });
  }
}
