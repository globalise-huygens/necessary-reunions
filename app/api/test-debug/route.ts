import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('[TEST DEBUG] This is a test route');

  const authToken = process.env.ANNO_REPO_TOKEN_JONA;
  console.log('[TEST DEBUG] Auth token exists:', !!authToken);
  console.log('[TEST DEBUG] Auth token length:', authToken?.length || 0);

  return NextResponse.json({
    message: 'Test route working',
    hasAuthToken: !!authToken,
    authTokenLength: authToken?.length || 0,
    timestamp: Date.now(),
  });
}
