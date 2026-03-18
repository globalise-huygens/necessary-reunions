import { projects } from '@/lib/projects';
import { NextResponse } from 'next/server';

interface ProbeResult {
  method: string;
  reachable: boolean;
  status?: number;
  latencyMs: number;
  error?: string;
  errorCause?: string;
}

interface TargetResult {
  probes: ProbeResult[];
}

interface DebugResponse {
  timestamp: string;
  runtime: string;
  nodeVersion: string;
  envCheck: Record<string, boolean>;
  controlProbe: ProbeResult;
  results: Record<string, TargetResult>;
}

async function probe(
  url: string,
  method: string,
  headers?: Record<string, string>,
): Promise<ProbeResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers,
    });
    clearTimeout(timer);
    return {
      method,
      reachable: true,
      status: res.status,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : 'Unknown';
    const cause =
      err instanceof Error && err.cause instanceof Error
        ? err.cause.message
        : undefined;
    return {
      method,
      reachable: false,
      latencyMs: Date.now() - start,
      error: msg,
      errorCause: cause,
    };
  }
}

/**
 * GET /api/debug/annorepo
 *
 * Tests connectivity from the serverless function to each project's
 * AnnoRepo instance using multiple methods. Includes a control probe
 * to a known-reachable URL to isolate networking issues.
 */
export async function GET(
  request: Request,
): Promise<NextResponse<DebugResponse>> {
  const url = new URL(request.url);
  const projectSlug = url.searchParams.get('project');

  const targets = projectSlug
    ? { [projectSlug]: projects[projectSlug] }
    : projects;

  // Control probe: known-reachable public URL
  const controlProbe = await probe('https://httpbin.org/get', 'GET');

  const results: Record<string, TargetResult> = {};

  for (const [slug, config] of Object.entries(targets)) {
    if (!config) {
      results[slug] = {
        probes: [
          {
            method: 'n/a',
            reachable: false,
            latencyMs: 0,
            error: 'Unknown project',
          },
        ],
      };
      continue;
    }

    const baseUrl = config.annoRepoBaseUrl;
    const probes = await Promise.all([
      probe(baseUrl, 'HEAD', { 'User-Agent': 'NeRu-Debug/1.0' }),
      probe(baseUrl, 'GET'),
      probe(`${baseUrl}/w3c/${config.annoRepoContainer}/`, 'GET'),
    ]);

    results[slug] = { probes };
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    runtime: process.env.NETLIFY ? 'netlify' : 'local',
    nodeVersion: process.version,
    envCheck: {
      NETLIFY: !!process.env.NETLIFY,
      ANNO_REPO_TOKEN_JONA: !!process.env.ANNO_REPO_TOKEN_JONA,
      SURINAME_ANNOREPO_TOKEN: !!process.env.SURINAME_ANNOREPO_TOKEN,
    },
    controlProbe,
    results,
  });
}
