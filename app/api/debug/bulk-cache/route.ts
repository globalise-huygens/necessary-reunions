import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'clear') {
    // The cache will be cleared naturally when the client refreshes
    // For now, just return a success message
    return NextResponse.json({
      message: 'Cache will be cleared on next page refresh',
      timestamp: new Date().toISOString(),
      note: 'Client-side cache clearing not available from server API',
    });
  }

  return NextResponse.json({
    message: 'Cache debug endpoint',
    available_actions: ['clear'],
    usage: '?action=clear to clear cache',
    note: 'Actual cache clearing happens on client side',
  });
}
