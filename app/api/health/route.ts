import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const project = url.searchParams.get('project') || 'neru';
  const check = url.searchParams.get('check');

  const base = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    nextVersion: process.env.__NEXT_VERSION || 'unknown',
    nodeVersion: process.version,
    openssl: process.versions.openssl,
  };

  if (check === 'annorepo') {
    return NextResponse.json({
      ...base,
      deprecated: true,
      message:
        'AnnoRepo connectivity diagnostics moved to /api/debug/annorepo. The /api/health?check=annorepo path is retained for compatibility only.',
      diagnostics: {
        endpoint: '/api/debug/annorepo',
        project,
      },
    });
  }

  return NextResponse.json(base);
}
