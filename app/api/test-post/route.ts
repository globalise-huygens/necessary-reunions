import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({
      status: 'ok',
      echo: body,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Failed to parse JSON body' },
      { status: 400 },
    );
  }
}
