import { NextResponse } from 'next/server';

interface TestResponse {
  success: boolean;
  message: string;
  timestamp: string;
  deployment: string;
}

export async function GET(): Promise<NextResponse<TestResponse>> {
  await Promise.resolve();
  return NextResponse.json({
    success: true,
    message: 'API is working - FORCED REBUILD',
    timestamp: new Date().toISOString(),
    deployment: 'FIXED-VERSION',
  });
}
