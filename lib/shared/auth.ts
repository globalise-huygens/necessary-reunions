/**
 * Serverless-compatible authentication helper.
 *
 * Uses `getToken` from next-auth/jwt to read the session JWT directly
 * from the request cookies. Unlike `getServerSession`, this approach
 * does not depend on Next.js internal request/response construction
 * and remains compatible across Next.js versions and serverless runtimes
 * (including Netlify functions).
 */

import { getToken, type JWT } from 'next-auth/jwt';
import { NextRequest } from 'next/server';

export interface AuthUser {
  id: string;
  type: string;
  label: string;
  allowedProjects: string[];
}

export interface AuthResult {
  user: AuthUser;
  token: JWT;
}

/**
 * Authenticate the incoming request by decoding the session JWT cookie.
 * Returns null when the request has no valid session (equivalent to
 * `getServerSession` returning null).
 */
export async function getAuthFromRequest(
  request: Request,
): Promise<AuthResult | null> {
  const token = await getToken({
    req: new NextRequest(request),
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.sub) return null;

  const user: AuthUser = {
    id: token.sub,
    type: 'Person',
    label: (token.label as string | undefined) ?? '',
    allowedProjects: (token.allowedProjects as string[] | undefined) ?? [],
  };

  return { user, token };
}
