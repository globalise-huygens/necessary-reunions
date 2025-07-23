import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const annotationId = searchParams.get('annotationId');
    const motivation = searchParams.get('motivation');

    if (!annotationId || !motivation) {
      return NextResponse.json({ linkingAnnotation: null });
    }

    const ANNOREPO_BASE_URL =
      process.env.ANNOREPO_BASE_URL ||
      'https://annorepo.globalise.huygens.knaw.nl';
    const CONTAINER = 'necessary-reunions';

    const endpoint = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose`;
    const encodedTarget = btoa(annotationId);
    const queryUrl = `${endpoint}:target=${encodedTarget},motivationorpurpose=${motivation}`;

    const response = await fetch(queryUrl, {
      headers: {
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const linkingAnnotations = Array.isArray(data.items) ? data.items : [];

      const linkingAnnotation =
        linkingAnnotations.length > 0 ? linkingAnnotations[0] : null;

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
