import { resolveAnnoRepoConfig } from '@/lib/shared/annorepo-config';
import { NextResponse } from 'next/server';

export const runtime = 'edge';
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
): Promise<NextResponse<{ classifications: IconographyClassification[] }>> {
  try {
    const { slug } = await context.params;
    const config = resolveAnnoRepoConfig('neru');

    const searchUrl = `${config.baseUrl}/services/${config.container}/custom-query/${config.linkingQueryName}:target=,motivationorpurpose=bGlua2luZw==`;

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

    const matchingAnnotations = annotations.filter((ann) => {
      const bodies = Array.isArray(ann.body)
        ? ann.body
        : ann.body
          ? [ann.body]
          : [];

      interface GeotagBody {
        purpose?: string;
        source?: {
          preferredTerm?: string;
          label?: string;
        };
      }

      const geotagBody = bodies.find(
        (b: unknown): b is GeotagBody =>
          typeof b === 'object' &&
          b !== null &&
          'purpose' in b &&
          b.purpose === 'geotagging',
      );

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

    const allTargetIds = new Set<string>();
    matchingAnnotations.forEach((ann) => {
      if (Array.isArray(ann.target)) {
        ann.target.forEach((t) => {
          if (typeof t === 'string') allTargetIds.add(t);
        });
      }
    });

    const targetIds = Array.from(allTargetIds).slice(0, 30);
    const results = await Promise.allSettled(
      targetIds.map((id) => fetchTargetAnnotation(id)),
    );

    const classifications: IconographyClassification[] = [];

    interface AnnotationBody {
      purpose?: string;
      source?: {
        label?: string;
        id?: string;
      };
      creator?: {
        id?: string;
        type?: string;
        label?: string;
      };
      created?: string;
    }

    results.forEach((fetchResult) => {
      if (fetchResult.status === 'fulfilled' && fetchResult.value) {
        const annotation = fetchResult.value;
        const isIconography =
          annotation.motivation === 'iconography' ||
          annotation.motivation === 'iconograpy';

        if (isIconography) {
          const bodies = Array.isArray(annotation.body)
            ? annotation.body
            : annotation.body
              ? [annotation.body]
              : [];

          bodies.forEach((body: unknown) => {
            const typedBody = body as AnnotationBody;
            if (
              typedBody.purpose === 'classifying' &&
              typedBody.source?.label
            ) {
              classifications.push({
                label: typedBody.source.label,
                id: typedBody.source.id || '',
                creator: typedBody.creator
                  ? {
                      id: typedBody.creator.id || '',
                      type: typedBody.creator.type || 'Person',
                      label: typedBody.creator.label || '',
                    }
                  : undefined,
                created: typedBody.created,
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
