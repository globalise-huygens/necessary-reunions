import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

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
    annotationUrl = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}/${encodeURIComponent(decodedId)}`;
  }

  try {
    const authToken = process.env.ANNO_REPO_TOKEN_JONA;
    if (!authToken) {
      throw new Error('AnnoRepo authentication token not configured');
    }

    const response = await fetch(annotationUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('AnnoRepo delete error:', response.status, errorText);
      throw new Error(`AnnoRepo deletion failed: ${response.status} ${response.statusText}`);
    }

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

  let annotationUrl: string;
  const decodedId = decodeURIComponent(id);

  if (decodedId.startsWith('https://')) {
    annotationUrl = decodedId;
  } else {
    annotationUrl = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}/${encodeURIComponent(decodedId)}`;
  }

  try {
    const body = await request.json();

    // Important: Do NOT set annotation-level creator for textspotting annotations
    // Human edits should be tracked at the body level, not annotation level
    const updatedAnnotation = {
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      ...body,
      modified: new Date().toISOString(),
    };

    const authToken = process.env.ANNO_REPO_TOKEN_JONA;
    if (!authToken) {
      throw new Error('AnnoRepo authentication token not configured');
    }

    const response = await fetch(annotationUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(updatedAnnotation),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('AnnoRepo update error:', response.status, errorText);
      throw new Error(`AnnoRepo update failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error updating annotation:', err);
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
  }
}
