import { NextRequest, NextResponse } from 'next/server';
import { encodeCanvasUri } from '../../../../../lib/shared/utils';
import { resolveAnnoRepoConfig } from '@/lib/shared/annorepo-config';

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
  const project = searchParams.get('project') || 'neru';
  const config = resolveAnnoRepoConfig(project);

  const debugInfo = {
    timestamp: new Date().toISOString(),
    requestUrl: request.url,
    project,
    targetCanvasId: targetCanvasId || '[not provided]',
    targetCanvasIdLength: targetCanvasId?.length || 0,
    encoded: targetCanvasId ? encodeCanvasUri(targetCanvasId) : '[no canvas]',
    environment: {
      hasAuthToken: !!config.authToken,
      authTokenLength: config.authToken?.length || 0,
      nodeEnv: process.env.NODE_ENV,
      netlifyContext: process.env.CONTEXT || '[not netlify]',
    },
    testUrl: targetCanvasId
      ? `${config.baseUrl}/services/${config.container}/custom-query/${config.customQueryName}:target=${encodeCanvasUri(targetCanvasId)}`
      : '[no canvas provided]',
  };

  return NextResponse.json(debugInfo);
}
