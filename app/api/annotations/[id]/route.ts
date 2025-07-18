import { deleteAnnotation, updateAnnotation } from '@/lib/annoRepo';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to delete annotations' },
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
    console.error('Error deleting annotation:', err);
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to update annotations' },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  console.log('PUT request for annotation ID:', id);

  let annotationUrl: string;
  const decodedId = decodeURIComponent(id);

  console.log('Decoded ID:', decodedId);

  if (decodedId.startsWith('https://')) {
    annotationUrl = decodedId;
  } else {
    annotationUrl = `https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/${encodeURIComponent(
      decodedId,
    )}`;
  }

  console.log('Final annotation URL:', annotationUrl);

  try {
    const body = await request.json();

    const user = session.user as any;
    const updatedAnnotation = {
      ...body,
      creator: {
        id: user?.id || user?.email,
        type: 'Person',
        label: user?.label || user?.name || 'Unknown User',
      },
      modified: new Date().toISOString(),
    };

    const result = await updateAnnotation(annotationUrl, updatedAnnotation);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error updating annotation:', err);
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
  }
}
