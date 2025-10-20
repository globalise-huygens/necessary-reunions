import { NextResponse } from 'next/server';
import { analyzeLinkingAnnotation } from '../../../../lib/viewer/linking-repair';

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

    const analysis = analyzeLinkingAnnotation(annotation);

    return NextResponse.json({
      annotation,
      analysis,
      isLinkingAnnotation:
        'motivation' in annotation && annotation.motivation === 'linking',
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
    const { annotationId, repair } = (await request.json()) as {
      annotationId?: string;
      repair?: boolean;
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
    const analysis = analyzeLinkingAnnotation(annotation);

    if (repair && analysis.needsRepair && analysis.repairedAnnotation) {
      return NextResponse.json({
        original: annotation,
        analysis,
        repaired: analysis.repairedAnnotation,
        message: 'Repair preview (not actually saved)',
      });
    }

    return NextResponse.json({
      annotation,
      analysis,
    });
  } catch (error) {
    console.error('Error in annotation debug:', error);
    return NextResponse.json(
      { error: 'Failed to process annotation' },
      { status: 500 },
    );
  }
}
