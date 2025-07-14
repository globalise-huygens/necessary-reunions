import { createAnnotation } from '@/lib/annoRepo';
import { encodeCanvasUri } from '@/lib/utils';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to create linking annotations' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();

    // Check if any of the target annotations already have linking annotations
    const targets = Array.isArray(body.target) ? body.target : [body.target];

    // Fetch existing linking annotations to check for conflicts
    const response = await fetch(
      `${
        process.env.ANNOREPO_BASE_URL ||
        'https://annorepo.globalise.huygens.knaw.nl'
      }/services/necessary-reunions/search?motivation=linking`,
    );

    if (response.ok) {
      const data = await response.json();
      const existingLinkingAnnotations = Array.isArray(data.items)
        ? data.items
        : [];

      // Check if any target is already linked
      const conflictingAnnotations = existingLinkingAnnotations.filter(
        (existing: any) => {
          if (Array.isArray(existing.target)) {
            return existing.target.some((existingTarget: string) =>
              targets.includes(existingTarget),
            );
          }
          return targets.includes(existing.target);
        },
      );

      if (conflictingAnnotations.length > 0) {
        return NextResponse.json(
          {
            error:
              'One or more annotations are already part of a linking annotation',
            conflictingAnnotations: conflictingAnnotations.map(
              (a: any) => a.id,
            ),
          },
          { status: 409 },
        );
      }
    }

    const user = session.user as any;
    let linkingAnnotationWithCreator = { ...body };

    if (!linkingAnnotationWithCreator.creator) {
      linkingAnnotationWithCreator.creator = {
        id: user?.id || user?.email,
        type: 'Person',
        label: user?.label || user?.name || 'Unknown User',
      };
    }

    if (!linkingAnnotationWithCreator.created) {
      linkingAnnotationWithCreator.created = new Date().toISOString();
    }

    // Ensure the motivation is set to linking
    linkingAnnotationWithCreator.motivation = 'linking';

    const created = await createAnnotation(linkingAnnotationWithCreator);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    console.error('Error creating linking annotation:', err);
    return new NextResponse(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const canvasId = searchParams.get('canvasId');

    if (!canvasId) {
      return NextResponse.json({ annotations: [] });
    }

    // Use the same pattern as regular annotations but filter for linking motivation
    const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
    const CONTAINER = 'necessary-reunions';
    const QUERY_NAME = 'with-target';

    // Encode the canvas URI the same way as regular annotations
    const encoded = encodeCanvasUri(canvasId);
    const endpoint = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/${QUERY_NAME}:target=${encoded}`;

    const response = await fetch(endpoint);

    if (!response.ok) {
      console.error(
        'Failed to fetch annotations from AnnoRepo, status:',
        response.status,
      );
      return NextResponse.json({ annotations: [] });
    }

    const data = await response.json();
    const allAnnotations = Array.isArray(data.items) ? data.items : [];

    // Filter for linking annotations
    const linkingAnnotations = allAnnotations.filter(
      (annotation: any) => annotation.motivation === 'linking',
    );

    return NextResponse.json({ annotations: linkingAnnotations });
  } catch (error) {
    console.error('Error fetching linking annotations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch linking annotations' },
      { status: 500 },
    );
  }
}
