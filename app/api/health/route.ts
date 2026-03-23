import { resolveAnnoRepoConfig } from '@/lib/shared/annorepo-config';
import { serverFetch } from '@/lib/shared/server-fetch';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const project = url.searchParams.get('project');
  const checkAnnoRepo = url.searchParams.get('check') === 'annorepo';

  const base = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    nextVersion: process.env.__NEXT_VERSION || 'unknown',
    nodeVersion: process.version,
  };

  if (!checkAnnoRepo) {
    return NextResponse.json(base);
  }

  const { baseUrl, container, authToken } = resolveAnnoRepoConfig(project);
  const target = `${baseUrl}/about`;

  try {
    const res = await serverFetch(
      target,
      { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} },
      10000,
    );
    const body = await res.text().catch(() => '');
    return NextResponse.json({
      ...base,
      annorepo: {
        reachable: res.ok,
        status: res.status,
        url: target,
        container,
        hasToken: !!authToken,
        body: body.slice(0, 300),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    const underlying =
      err instanceof Error && err.cause instanceof Error
        ? err.cause.message
        : undefined;
    return NextResponse.json({
      ...base,
      annorepo: {
        reachable: false,
        url: target,
        container,
        hasToken: !!authToken,
        error: msg,
        detail: underlying,
      },
    });
  }
}
