import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
): Promise<NextResponse<{ error: string } | Record<string, unknown>>> {
  try {
    const { searchParams } = new URL(request.url);
    const annotationId = searchParams.get('id');

    if (!annotationId) {
      return NextResponse.json(
        { error: 'Annotation ID required' },
        { status: 400 },
      );
    }

    const response = await fetch(annotationId, {
      headers: {
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch annotation' },
        { status: 404 },
      );
    }

    const annotation = (await response.json()) as Record<string, unknown>;

    const isLinkingAnnotation =
      'motivation' in annotation && annotation.motivation === 'linking';
    const hasTargets =
      'target' in annotation &&
      (Array.isArray(annotation.target)
        ? annotation.target.length > 0
        : !!annotation.target);
    const hasBody = 'body' in annotation && Array.isArray(annotation.body);

    return NextResponse.json({
      annotation,
      analysis: {
        isLinkingAnnotation,
        hasTargets,
        hasBody,
        targetCount: Array.isArray(annotation.target)
          ? annotation.target.length
          : 0,
        bodyCount: Array.isArray(annotation.body) ? annotation.body.length : 0,
      },
      isLinkingAnnotation,
    });
  } catch (error) {
    console.error('Error analyzing annotation:', error);
    return NextResponse.json(
      { error: 'Failed to analyze annotation' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
): Promise<NextResponse<{ error: string } | Record<string, unknown>>> {
  try {
    const { annotationId } = (await request.json()) as {
      annotationId?: string;
    };

    if (!annotationId) {
      return NextResponse.json(
        { error: 'Annotation ID required' },
        { status: 400 },
      );
    }

    const response = await fetch(annotationId, {
      headers: {
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch annotation' },
        { status: 404 },
      );
    }

    const annotation = (await response.json()) as Record<string, unknown>;

    const isLinkingAnnotation =
      'motivation' in annotation && annotation.motivation === 'linking';
    const hasTargets =
      'target' in annotation &&
      (Array.isArray(annotation.target)
        ? annotation.target.length > 0
        : !!annotation.target);
    const hasBody = 'body' in annotation && Array.isArray(annotation.body);

    return NextResponse.json({
      annotation,
      analysis: {
        isLinkingAnnotation,
        hasTargets,
        hasBody,
        targetCount: Array.isArray(annotation.target)
          ? annotation.target.length
          : 0,
        bodyCount: Array.isArray(annotation.body) ? annotation.body.length : 0,
      },
    });
  } catch (error) {
    console.error('Error in annotation debug:', error);
    return NextResponse.json(
      { error: 'Failed to process annotation' },
      { status: 500 },
    );
  }
}
