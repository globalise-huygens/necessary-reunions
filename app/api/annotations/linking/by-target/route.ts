import { resolveAnnoRepoConfig } from '@/lib/shared/annorepo-config';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
): Promise<
  NextResponse<
    { linkingAnnotation: Record<string, unknown> | null } | { error: string }
  >
> {
  try {
    const { searchParams } = new URL(request.url);
    const annotationId = searchParams.get('annotationId');
    const motivation = searchParams.get('motivation');

    if (!annotationId || !motivation) {
      return NextResponse.json({ linkingAnnotation: null });
    }

    const project = searchParams.get('project') || 'neru';
    const config = resolveAnnoRepoConfig(project);

    const endpoint = `${config.baseUrl}/services/${config.container}/custom-query/${config.customQueryName}`;
    const encodedTarget = btoa(annotationId);
    const queryUrl = `${endpoint}:target=${encodedTarget},motivationorpurpose=${motivation}`;

    const response = await fetch(queryUrl, {
      headers: {
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      },
    });

    if (response.ok) {
      const data = (await response.json()) as {
        items?: Array<Record<string, unknown>>;
      };
      const linkingAnnotations: Array<Record<string, unknown>> = Array.isArray(
        data.items,
      )
        ? data.items
        : [];

      const linkingAnnotation: Record<string, unknown> | null =
        linkingAnnotations.length > 0 ? linkingAnnotations[0]! : null;

      return NextResponse.json({ linkingAnnotation });
    }

    return NextResponse.json({ linkingAnnotation: null });
  } catch (error) {
    console.error('Error fetching linking annotation by target:', error);
    return NextResponse.json(
      { error: 'Failed to fetch linking annotation' },
      { status: 500 },
    );
  }
}
