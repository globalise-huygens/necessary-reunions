import { createAnnotation } from '@/lib/annoRepo';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/authOptions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to create annotations' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();

    const user = session.user as any;
    let annotationWithCreator = { ...body };

    if (!annotationWithCreator.creator) {
      annotationWithCreator.creator = {
        id: user?.id || user?.email,
        type: 'Person',
        label: user?.label || user?.name || 'Unknown User',
      };
    }

    if (!annotationWithCreator.created) {
      annotationWithCreator.created = new Date().toISOString();
    }

    if (annotationWithCreator.motivation === 'textspotting') {
      const bodies = Array.isArray(annotationWithCreator.body)
        ? annotationWithCreator.body
        : [annotationWithCreator.body].filter(Boolean);

      if (bodies.length === 0) {
        annotationWithCreator.body = [
          {
            type: 'TextualBody',
            value: '',
            format: 'text/plain',
            purpose: 'supplementing',
          },
        ];
      }
    }

    const createdArr = await createAnnotation(annotationWithCreator);
    const created = Array.isArray(createdArr) ? createdArr[0] : createdArr;
    return NextResponse.json(
      {
        ...annotationWithCreator,
        id: created.annotationName,
        etag: created.etag,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('Error creating annotation:', err);
    return new NextResponse(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
