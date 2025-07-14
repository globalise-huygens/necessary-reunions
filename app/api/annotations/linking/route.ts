import { createAnnotation } from '@/lib/annoRepo';
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

    // For now, we'll fetch all linking annotations and filter them
    // In a real implementation, you might want to optimize this with a proper query
    const response = await fetch(`${process.env.ANNOREPO_BASE_URL || 'https://annorepo.globalise.huygens.knaw.nl'}/services/necessary-reunions/search?motivation=linking`);
    
    if (!response.ok) {
      console.error('Failed to fetch linking annotations from AnnoRepo');
      return NextResponse.json({ annotations: [] });
    }

    const data = await response.json();
    const allLinkingAnnotations = Array.isArray(data.items) ? data.items : [];

    // Filter linking annotations that reference the canvas
    const relevantLinkingAnnotations = allLinkingAnnotations.filter((annotation: any) => {
      // Check if any of the targets reference the current canvas
      if (Array.isArray(annotation.target)) {
        return annotation.target.some((target: string) => {
          // This is a simplified check - in practice you might need more sophisticated filtering
          return target.includes(canvasId);
        });
      }
      return false;
    });

    return NextResponse.json({ annotations: relevantLinkingAnnotations });
  } catch (error) {
    console.error('Error fetching linking annotations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch linking annotations' },
      { status: 500 },
    );
  }
}
