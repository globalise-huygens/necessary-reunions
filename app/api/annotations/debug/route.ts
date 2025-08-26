import { analyzeLinkingAnnotation } from '@/lib/viewer/linking-repair';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const annotationId = searchParams.get('id');

    if (!annotationId) {
      return NextResponse.json(
        { error: 'Annotation ID required' },
        { status: 400 },
      );
    }

    // Fetch the annotation from the repository
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

    const annotation = await response.json();

    // Analyze the annotation structure
    const analysis = analyzeLinkingAnnotation(annotation);

    return NextResponse.json({
      annotation,
      analysis,
      isLinkingAnnotation: annotation.motivation === 'linking',
    });
  } catch (error) {
    console.error('Error analyzing annotation:', error);
    return NextResponse.json(
      { error: 'Failed to analyze annotation' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { annotationId, repair } = await request.json();

    if (!annotationId) {
      return NextResponse.json(
        { error: 'Annotation ID required' },
        { status: 400 },
      );
    }

    // Fetch the annotation from the repository
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

    const annotation = await response.json();
    const analysis = analyzeLinkingAnnotation(annotation);

    if (repair && analysis.needsRepair && analysis.repairedAnnotation) {
      // Note: In a real implementation, you'd want proper authentication and authorization here
      // For now, just return what the repaired annotation would look like
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
