import { getAuthFromRequest } from '@/lib/shared/auth';
import { NextResponse } from 'next/server';

interface EnvCheck {
  ORCID_CLIENT_ID: boolean;
  ORCID_CLIENT_SECRET: boolean;
  NEXTAUTH_SECRET: boolean;
  ANNO_REPO_TOKEN_JONA: boolean;
  ORCID_ALLOWLIST: boolean;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const envCheck: EnvCheck = {
      ORCID_CLIENT_ID: !!process.env.ORCID_CLIENT_ID,
      ORCID_CLIENT_SECRET: !!process.env.ORCID_CLIENT_SECRET,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      ANNO_REPO_TOKEN_JONA: !!process.env.ANNO_REPO_TOKEN_JONA,
      ORCID_ALLOWLIST: !!process.env.ORCID_ALLOWLIST,
    };

    const auth = await getAuthFromRequest(request);

    return NextResponse.json({
      environment: envCheck,
      authMethod: 'getToken (jwt)',
      session: auth ? { user: auth.user } : null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error');
    return NextResponse.json(
      {
        error: error.message,
        stack: error.stack,
        environment: {
          ORCID_CLIENT_ID: !!process.env.ORCID_CLIENT_ID,
          ORCID_CLIENT_SECRET: !!process.env.ORCID_CLIENT_SECRET,
          NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
          ANNO_REPO_TOKEN_JONA: !!process.env.ANNO_REPO_TOKEN_JONA,
        },
      },
      { status: 500 },
    );
  }
}
