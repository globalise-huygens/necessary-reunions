import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

interface EnvCheck {
  ORCID_CLIENT_ID: boolean;
  ORCID_CLIENT_SECRET: boolean;
  NEXTAUTH_SECRET: boolean;
  ANNO_REPO_TOKEN_JONA: boolean;
  ORCID_ALLOWLIST: string;
}

interface DebugResponse {
  environment: EnvCheck;
  session: {
    user: unknown;
    expires: string;
  } | null;
  timestamp: string;
}

interface ErrorResponse {
  error: string;
  stack?: string;
  environment: Omit<EnvCheck, 'ORCID_ALLOWLIST'>;
}

export async function GET(): Promise<
  NextResponse<DebugResponse | ErrorResponse>
> {
  try {
    const envCheck = {
      ORCID_CLIENT_ID: !!process.env.ORCID_CLIENT_ID,
      ORCID_CLIENT_SECRET: !!process.env.ORCID_CLIENT_SECRET,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      ANNO_REPO_TOKEN_JONA: !!process.env.ANNO_REPO_TOKEN_JONA,
      ORCID_ALLOWLIST: process.env.ORCID_ALLOWLIST || 'not set',
    };

    const session = await getServerSession(authOptions);

    return NextResponse.json({
      environment: envCheck,
      session: session
        ? {
            user: session.user,
            expires: session.expires,
          }
        : null,
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
