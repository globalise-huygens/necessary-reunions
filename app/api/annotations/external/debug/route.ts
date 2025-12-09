import { NextRequest, NextResponse } from 'next/server';
import { encodeCanvasUri } from '../../../../../lib/shared/utils';

/**
 * Debug endpoint to diagnose why external annotations return 0 items in production
 * This endpoint reveals server-side environment state without making external API calls
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const targetCanvasId = searchParams.get('targetCanvasId');

  const debugInfo = {
    timestamp: new Date().toISOString(),
    requestUrl: request.url,
    targetCanvasId: targetCanvasId || '[not provided]',
    targetCanvasIdLength: targetCanvasId?.length || 0,
    encoded: targetCanvasId ? encodeCanvasUri(targetCanvasId) : '[no canvas]',
    environment: {
      hasAuthToken: !!process.env.ANNO_REPO_TOKEN_JONA,
      authTokenLength: process.env.ANNO_REPO_TOKEN_JONA?.length || 0,
      nodeEnv: process.env.NODE_ENV,
      netlifyContext: process.env.CONTEXT || '[not netlify]',
    },
    testUrl: targetCanvasId
      ? `https://annorepo.globalise.huygens.knaw.nl/services/necessary-reunions/custom-query/with-target:target=${encodeCanvasUri(targetCanvasId)}`
      : '[no canvas provided]',
  };

  console.log('[Debug Endpoint]', JSON.stringify(debugInfo, null, 2));

  return NextResponse.json(debugInfo);
}
