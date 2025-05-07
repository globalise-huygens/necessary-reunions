import { NextResponse } from 'next/server';
import { deleteAnnotation } from '@/lib/annoRepo';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const annotationUrl = `https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/${encodeURIComponent(
    id,
  )}`;

  try {
    await deleteAnnotation(annotationUrl);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error('Error deleting annotation:', err);
    return new NextResponse(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
