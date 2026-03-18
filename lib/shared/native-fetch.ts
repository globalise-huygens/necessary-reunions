/**
 * Alternative HTTP client using node:https instead of undici-based fetch.
 *
 * Some servers reject connections from Node.js 22's built-in fetch (undici)
 * due to TLS/HTTP2 negotiation differences. This module provides a fallback
 * using the classic node:https module which has different connection behaviour.
 */

import http from 'node:http';
import https from 'node:https';

export interface NativeRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface NativeResponse {
  status: number;
  statusText: string;
  ok: boolean;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  /** Parse body as JSON */
  json<T = unknown>(): T;
}

/**
 * Make an HTTP(S) request using node:https/node:http modules.
 * Falls back to the classic Node.js TLS stack instead of undici.
 */
export function nativeFetch(
  url: string,
  options: NativeRequestOptions = {},
): Promise<NativeResponse> {
  const { method = 'GET', headers = {}, body, timeoutMs = 15000 } = options;

  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const reqOptions: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        ...headers,
        ...(body
          ? { 'Content-Length': Buffer.byteLength(body).toString() }
          : {}),
      },
      // Explicit TLS settings for compatibility with older servers
      ...(isHttps
        ? {
            rejectUnauthorized: true,
            minVersion: 'TLSv1.2' as const,
          }
        : {}),
    };

    const req = transport.request(reqOptions, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString('utf-8');
        const status = res.statusCode || 0;
        resolve({
          status,
          statusText: res.statusMessage || '',
          ok: status >= 200 && status < 300,
          headers: res.headers as Record<string, string | string[] | undefined>,
          body: responseBody,
          json<T = unknown>(): T {
            return JSON.parse(responseBody) as T;
          },
        });
      });
    });

    req.on('error', reject);

    if (timeoutMs > 0) {
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
      });
    }

    if (body) {
      req.write(body);
    }

    req.end();
  });
}
