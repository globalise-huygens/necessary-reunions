import { projects } from '@/lib/projects';
import { NextResponse } from 'next/server';

/**
 * GET /api/debug/annorepo?project=suriname
 *
 * Tests connectivity from the serverless function to each project's
 * AnnoRepo instance. Does not require authentication — only checks
 * network reachability (no token sent, no data modified).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectSlug = url.searchParams.get('project');

  const targets = projectSlug
    ? { [projectSlug]: projects[projectSlug] }
    : projects;

  const results: Record<
    string,
    { reachable: boolean; status?: number; latencyMs: number; error?: string }
  > = {};

  for (const [slug, config] of Object.entries(targets)) {
    if (!config) {
      results[slug] = {
        reachable: false,
        latencyMs: 0,
        error: 'Unknown project',
      };
      continue;
    }

    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(config.annoRepoBaseUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': 'NeRu-Debug/1.0' },
      });
      clearTimeout(timer);
      results[slug] = {
        reachable: true,
        status: res.status,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : 'Unknown';
      results[slug] = {
        reachable: false,
        latencyMs: Date.now() - start,
        error: msg,
      };
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    runtime: process.env.NETLIFY ? 'netlify' : 'local',
    results,
  });
}
