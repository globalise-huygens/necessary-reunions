import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/authOptions';
import {
  deleteAnnotation,
  updateAnnotation,
  fetchAnnotationWithEtag,
} from '@/lib/annoRepo';

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
    const annotationUrl = `https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/${encodeURIComponent(
      id,
    )}`;

    const result = await updateAnnotation(annotationUrl, body, etag);

    const updatedPointSelectorBody = result.annotation.body?.find(
      (b: any) =>
        b.purpose === 'selecting' &&
        b.selector &&
        b.selector.type === 'PointSelector',
    );
    if (updatedPointSelectorBody) {
    }

    return NextResponse.json(
      { ...result.annotation, etag: result.etag },
      { status: 200 },
    );
  } catch (err: any) {
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
      { error: 'Unauthorized – please sign in to delete annotations' },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const etag = request.headers.get('if-match');

  const annotationUrl = `https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/${encodeURIComponent(
    id,
  )}`;

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
