import { resolveAnnoRepoConfig } from '@/lib/shared/annorepo-config';
import { serverFetch } from '@/lib/shared/server-fetch';
import https from 'node:https';
import tls from 'node:tls';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Raw TLS + HTTP/1.1 test bypassing all abstractions. */
function rawHttpsGet(
  targetUrl: string,
  timeoutMs = 10000,
): Promise<{ status: number; body: string; alpn?: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': 'NeRu-Health/1.0',
          Accept: 'application/json',
          Host: parsed.hostname,
        },
        ALPNProtocols: ['http/1.1'],
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2' as const,
        servername: parsed.hostname,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const socket = res.socket as tls.TLSSocket;
          resolve({
            status: res.statusCode || 0,
            body: Buffer.concat(chunks).toString('utf-8'),
            alpn: socket?.alpnProtocol || undefined,
          });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () =>
      req.destroy(new Error(`Timed out after ${timeoutMs}ms`)),
    );
    req.end();
  });
}

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

  // Try raw node:https first (no wrappers)
  try {
    const raw = await rawHttpsGet(target);
    return NextResponse.json({
      ...base,
      openssl: process.versions.openssl,
      annorepo: {
        reachable: raw.status >= 200 && raw.status < 300,
        status: raw.status,
        alpn: raw.alpn,
        url: target,
        container,
        hasToken: !!authToken,
        body: raw.body.slice(0, 300),
        method: 'raw-https',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    const code = (err as NodeJS.ErrnoException)?.code;

    // Fall back to serverFetch for comparison
    let serverFetchResult: string | undefined;
    try {
      const res2 = await serverFetch(target, {}, 10000);
      serverFetchResult = `${res2.status} ${(await res2.text()).slice(0, 100)}`;
    } catch (e2) {
      serverFetchResult = `error: ${e2 instanceof Error ? e2.message : 'unknown'}`;
    }

    return NextResponse.json({
      ...base,
      openssl: process.versions.openssl,
      annorepo: {
        reachable: false,
        url: target,
        container,
        hasToken: !!authToken,
        error: msg,
        code,
        serverFetchResult,
        method: 'raw-https-failed',
      },
    });
  }
}
