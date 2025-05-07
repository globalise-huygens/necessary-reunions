import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // TODO: implement createAnnotation in lib/annoRepo.ts and import here
  try {
    const body = await request.json();
    // const created = await createAnnotation(body);
    // return NextResponse.json(created, { status: 201 });
    return new NextResponse('Not implemented', { status: 501 });
  } catch (err: any) {
    console.error('Error creating annotation:', err);
    return new NextResponse(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
