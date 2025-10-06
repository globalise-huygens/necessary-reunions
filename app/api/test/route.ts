import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'API is working - FORCED REBUILD',
    timestamp: new Date().toISOString(),
    deployment: 'FIXED-VERSION'
  });
}
