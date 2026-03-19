import { getAuthFromRequest } from '@/lib/shared/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await getAuthFromRequest(request);

  if (!auth) {
    return NextResponse.json(
      { authenticated: false, message: 'Sign in to view debug info' },
      { status: 401 },
    );
  }

  return NextResponse.json({
    authenticated: true,
    environment: {
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      ANNO_REPO_TOKEN_JONA: !!process.env.ANNO_REPO_TOKEN_JONA,
      SURINAME_ANNOREPO_TOKEN: !!process.env.SURINAME_ANNOREPO_TOKEN,
    },
    authMethod: 'getToken (jwt)',
    user: auth.user.id,
    allowedProjects: auth.user.allowedProjects,
    timestamp: new Date().toISOString(),
  });
}
