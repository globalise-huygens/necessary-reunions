import { NextResponse } from 'next/server';
import { createAnnotation } from '@/lib/annoRepo';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('API received annotation:', body);
    const created = await createAnnotation(body);
    console.log('AnnoRepo response:', created);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    console.error('Error creating annotation:', err);
    return new NextResponse(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
