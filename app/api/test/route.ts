import { NextResponse } from 'next/server';

interface TestResponse {
  success: boolean;
  message: string;
  timestamp: string;
  deployment: string;
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function GET(): Promise<NextResponse<TestResponse>> {
  return NextResponse.json({
    success: true,
    message: 'API is working - FORCED REBUILD',
    timestamp: new Date().toISOString(),
    deployment: 'FIXED-VERSION',
  });
}
