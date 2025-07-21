import {
  deleteAnnotation,
  fetchAnnotationWithEtag,
  updateAnnotation,
} from '@/lib/annoRepo';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const annotationUrl = `https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/${encodeURIComponent(
      id,
    )}`;
    const annotationWithEtag = await fetchAnnotationWithEtag(annotationUrl);
    return NextResponse.json(annotationWithEtag, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch annotation' },
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
      { error: 'Unauthorized – please sign in to delete annotations' },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const etag = request.headers.get('if-match');

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
    await deleteAnnotation(annotationUrl, etag || undefined);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
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
  const etag = request.headers.get('if-match');

  if (!etag) {
    return NextResponse.json(
      { error: 'If-Match header with ETag is required for updates' },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();

    let annotationUrl: string;
    const decodedId = decodeURIComponent(id);

    if (decodedId.startsWith('https://')) {
      annotationUrl = decodedId;
    } else {
      annotationUrl = `https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/${encodeURIComponent(
        id,
      )}`;
    }

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

    const result = await updateAnnotation(
      annotationUrl,
      updatedAnnotation,
      etag,
    );

    return NextResponse.json(
      { ...result.annotation, etag: result.etag },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error updating annotation:', err);
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
  }
}
