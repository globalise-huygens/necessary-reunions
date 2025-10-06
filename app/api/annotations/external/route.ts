import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('[EXTERNAL API] Returning empty response to stop 502 errors');

  // Return immediate empty response to stop infinite loops
  return NextResponse.json(
    {
      items: [],
      total: 0,
      message: 'External annotation service unavailable',
    },
    { status: 200 },
  );
}
