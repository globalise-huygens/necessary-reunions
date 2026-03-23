/**
 * Serverless-safe HTTP client for outbound API calls.
 *
 * Wraps `nativeFetch` (node:https) to avoid the "other side closed" errors
 * caused by Node.js 22's built-in fetch (undici) reusing stale connections
 * in serverless environments like Netlify Functions. Returns a standard
 * `Response`-like object compatible with existing route handler code.
 */

import { nativeFetch, type NativeResponse } from './native-fetch';

/** Thin adapter so callers can treat `NativeResponse` like `Response`. */
class ServerResponse {
  readonly status: number;
  readonly statusText: string;
  readonly ok: boolean;
  readonly headers: Headers;
  private readonly _body: string;

  constructor(native: NativeResponse) {
    this.status = native.status;
    this.statusText = native.statusText;
    this.ok = native.ok;
    this._body = native.body;

    const h = new Headers();
    for (const [k, v] of Object.entries(native.headers)) {
      if (v === undefined) continue;
      const values = Array.isArray(v) ? v : [v];
      for (const val of values) h.append(k, val);
    }
    this.headers = h;
  }

  async text(): Promise<string> {
    return this._body;
  }

  async json<T = unknown>(): Promise<T> {
    return JSON.parse(this._body) as T;
  }
}

export interface ServerFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Fetch a URL using node:https (bypasses undici connection pooling).
 * Drop-in replacement for `fetch(url, init)` in server-side route handlers.
 */
export async function serverFetch(
  url: string,
  init: ServerFetchInit = {},
  timeoutMs = 25000,
): Promise<ServerResponse> {
  const native = await nativeFetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
    timeoutMs,
  });
  return new ServerResponse(native);
}
