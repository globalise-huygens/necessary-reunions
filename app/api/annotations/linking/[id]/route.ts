import { deleteAnnotation, updateAnnotation } from '@/lib/annoRepo';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../../auth/[...nextauth]/authOptions';

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to update linking annotations' },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  let annotationUrl: string;
  const decodedId = decodeURIComponent(id);

  if (decodedId.startsWith('https://')) {
    annotationUrl = decodedId;
  } else {
    annotationUrl = `https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/${encodeURIComponent(
      decodedId,
    )}`;
  }

  try {
    const body = await request.json();

    // Check if any of the new target annotations already have linking annotations (excluding current one)
    const targets = Array.isArray(body.target) ? body.target : [body.target];

    // Fetch existing linking annotations to check for conflicts
    const fetchResponse = await fetch(
      `${
        process.env.ANNOREPO_BASE_URL ||
        'https://annorepo.globalise.huygens.knaw.nl'
      }/services/necessary-reunions/search?motivation=linking`,
    );

    if (fetchResponse.ok) {
      const data = await fetchResponse.json();
      const existingLinkingAnnotations = Array.isArray(data.items)
        ? data.items
        : [];

      // Check if any target is already linked (excluding the current annotation)
      const conflictingAnnotations = existingLinkingAnnotations.filter(
        (existing: any) => {
          // Skip the current annotation being updated
          if (existing.id === annotationUrl || existing.id === decodedId) {
            return false;
          }

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
    const updatedLinkingAnnotation = {
      ...body,
      motivation: 'linking',
      creator: {
        id: user?.id || user?.email,
        type: 'Person',
        label: user?.label || user?.name || 'Unknown User',
      },
      modified: new Date().toISOString(),
    };

    const result = await updateAnnotation(
      annotationUrl,
      updatedLinkingAnnotation,
    );
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error updating linking annotation:', err);
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to delete linking annotations' },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  let annotationUrl: string;
  const decodedId = decodeURIComponent(id);

  if (decodedId.startsWith('https://')) {
    annotationUrl = decodedId;
  } else {
    annotationUrl = `https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/${encodeURIComponent(
      decodedId,
    )}`;
  }

  try {
    await deleteAnnotation(annotationUrl);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error('Error deleting linking annotation:', err);
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
  }
}
