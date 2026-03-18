import { resolveAnnoRepoConfig } from '@/lib/shared/annorepo-config';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Diagnostic endpoint to test AnnoRepo write connectivity from Netlify.
 * Does NOT create a real annotation -- only tests auth + reachability.
 *
 * Usage: GET /api/debug/annorepo-write?project=suriname
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const project = searchParams.get('project') || 'neru';
  const config = resolveAnnoRepoConfig(project);

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    project,
    baseUrl: config.baseUrl,
    container: config.container,
    hasAuthToken: !!config.authToken,
    authTokenLength: config.authToken?.length || 0,
    authTokenPrefix: config.authToken?.slice(0, 4) || '[none]',
  };

  // Test 1: GET the container (no auth needed)
  try {
    const containerUrl = `${config.baseUrl}/w3c/${config.container}/`;
    const controller1 = new AbortController();
    const timer1 = setTimeout(() => controller1.abort(), 8000);
    const res1 = await fetch(containerUrl, { signal: controller1.signal });
    clearTimeout(timer1);
    results.containerGet = {
      url: containerUrl,
      status: res1.status,
      statusText: res1.statusText,
      ok: res1.ok,
    };
  } catch (err) {
    results.containerGet = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Test 2: GET the container WITH auth token (tests token validity)
  try {
    const containerUrl = `${config.baseUrl}/w3c/${config.container}/`;
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), 8000);
    const res2 = await fetch(containerUrl, {
      signal: controller2.signal,
      headers: {
        Authorization: `Bearer ${config.authToken}`,
      },
    });
    clearTimeout(timer2);
    const body2 = await res2.text().catch(() => '[unreadable]');
    results.containerGetAuth = {
      url: containerUrl,
      status: res2.status,
      statusText: res2.statusText,
      ok: res2.ok,
      bodyPreview: body2.slice(0, 300),
    };
  } catch (err) {
    results.containerGetAuth = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Test 3: POST a deliberately invalid annotation to test auth without side effects
  // AnnoRepo should reject it with 400 (bad request) if auth works,
  // or 401/403 if the token is invalid
  try {
    const postUrl = `${config.baseUrl}/w3c/${config.container}/`;
    const controller3 = new AbortController();
    const timer3 = setTimeout(() => controller3.abort(), 8000);
    const res3 = await fetch(postUrl, {
      method: 'POST',
      signal: controller3.signal,
      headers: {
        'Content-Type':
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        Authorization: `Bearer ${config.authToken}`,
      },
      body: JSON.stringify({
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        type: 'Annotation',
        __debug_test: true,
        motivation: 'tagging',
        target: 'urn:debug:connectivity-test',
        body: {
          type: 'TextualBody',
          value: 'connectivity-test',
        },
      }),
    });
    clearTimeout(timer3);
    const body3 = await res3.text().catch(() => '[unreadable]');
    results.postTest = {
      url: postUrl,
      status: res3.status,
      statusText: res3.statusText,
      ok: res3.ok,
      bodyPreview: body3.slice(0, 500),
    };
  } catch (err) {
    results.postTest = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json(results);
}
