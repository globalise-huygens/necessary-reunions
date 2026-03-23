import https from 'node:https';
import tls from 'node:tls';
import { resolveAnnoRepoConfig } from '@/lib/shared/annorepo-config';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Raw HTTPS GET with detailed TLS diagnostics. */
function rawHttpsGet(
  targetUrl: string,
  timeoutMs = 10000,
): Promise<{
  status: number;
  body: string;
  alpn?: string;
  tlsVersion?: string;
  cipher?: string;
}> {
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
            tlsVersion: socket?.getProtocol?.() || undefined,
            cipher: socket?.getCipher?.()?.name || undefined,
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

/** Test if standard fetch works (uses undici under the hood). */
async function testBuiltinFetch(
  targetUrl: string,
): Promise<{ ok: boolean; status?: number; body?: string; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      // @ts-expect-error -- undici dispatcher options
      cache: 'no-store',
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body: body.slice(0, 200) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    const cause =
      e instanceof Error && e.cause instanceof Error
        ? e.cause.message
        : undefined;
    return { ok: false, error: cause ? `${msg}: ${cause}` : msg };
  } finally {
    clearTimeout(timer);
  }
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
    openssl: process.versions.openssl,
  };

  if (!checkAnnoRepo) {
    return NextResponse.json(base);
  }

  const { baseUrl, container, authToken } = resolveAnnoRepoConfig(project);
  const annoRepoTarget = `${baseUrl}/about`;
  const controlTarget = 'https://httpbin.org/get';

  // Run all four tests in parallel
  const [rawAnnoRepo, rawControl, fetchAnnoRepo, fetchControl] =
    await Promise.allSettled([
      rawHttpsGet(annoRepoTarget),
      rawHttpsGet(controlTarget),
      testBuiltinFetch(annoRepoTarget),
      testBuiltinFetch(controlTarget),
    ]);

  function settled<T>(r: PromiseSettledResult<T>) {
    if (r.status === 'fulfilled') return { ok: true, value: r.value };
    const err = r.reason;
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: (err as NodeJS.ErrnoException)?.code,
    };
  }

  return NextResponse.json({
    ...base,
    container,
    hasToken: !!authToken,
    tests: {
      'node:https → AnnoRepo': settled(rawAnnoRepo),
      'node:https → httpbin.org': settled(rawControl),
      'fetch → AnnoRepo': settled(fetchAnnoRepo),
      'fetch → httpbin.org': settled(fetchControl),
    },
  });
}
