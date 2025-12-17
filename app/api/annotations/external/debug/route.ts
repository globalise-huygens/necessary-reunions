import { NextRequest, NextResponse } from 'next/server';
import { encodeCanvasUri } from '../../../../../lib/shared/utils';

type ExternalAnnotationsDebugResponseBody = {
  timestamp: string;
  requestUrl: string;
  targetCanvasId: string;
  targetCanvasIdLength: number;
  encoded: string;
  environment: {
    hasAuthToken: boolean;
    authTokenLength: number;
    nodeEnv: string | undefined;
    netlifyContext: string;
  };
  testUrl: string;
};

/**
 * Debug endpoint to diagnose why external annotations return 0 items in production
 * This endpoint reveals server-side environment state without making external API calls
 */
export function GET(
  request: NextRequest,
): NextResponse<ExternalAnnotationsDebugResponseBody> {
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

  return NextResponse.json(debugInfo);
}
