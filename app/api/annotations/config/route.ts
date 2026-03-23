import {
  canEditProject,
  resolveAnnoRepoConfig,
} from '@/lib/shared/annorepo-config';
import { getAuthFromRequest } from '@/lib/shared/auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Returns AnnoRepo connection details (including the bearer token) to
 * authenticated users who are on the ORCID allowlist.
 *
 * This enables the browser to call AnnoRepo directly, bypassing
 * the Netlify serverless function layer — which cannot reach
 * AnnoRepo because KNAW's firewall blocks AWS IP ranges.
 */
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const project = url.searchParams.get('project');

  const userOrcid = auth.user.id;
  if (!canEditProject(userOrcid, project)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { authToken } = resolveAnnoRepoConfig(project);
  if (!authToken) {
    return NextResponse.json(
      { error: 'AnnoRepo token not configured' },
      { status: 502 },
    );
  }

  return NextResponse.json({
    token: authToken,
    user: {
      id: auth.user.id,
      label: auth.user.label,
    },
  });
}
