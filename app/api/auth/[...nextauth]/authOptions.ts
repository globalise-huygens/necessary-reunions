import type { NextAuthOptions, User } from 'next-auth';
import { getAllProjects } from '@/lib/projects';

interface OrcidProfile {
  sub: string;
  given_name?: string;
  family_name?: string;
  [key: string]: unknown;
}

interface CustomUser extends User {
  id: string;
  type: string;
  label: string;
}

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: 'orcid',
      name: 'ORCID',
      type: 'oauth',
      version: '2.0',
      wellKnown: 'https://orcid.org/.well-known/openid-configuration',
      clientId: process.env.ORCID_CLIENT_ID!,
      clientSecret: process.env.ORCID_CLIENT_SECRET!,
      authorization: {
        url: 'https://orcid.org/oauth/authorize',
        params: {
          scope: 'openid profile',
          response_type: 'code',
        },
      },
      token: 'https://orcid.org/oauth/token',
      userinfo: 'https://orcid.org/oauth/userinfo',
      checks: ['pkce', 'state'],
      profile(profile: OrcidProfile): CustomUser {
        const given = profile.given_name ?? '';
        const family = profile.family_name ?? '';
        const orcidId = profile.sub.startsWith('https://orcid.org/')
          ? profile.sub
          : `https://orcid.org/${profile.sub}`;
        return {
          id: orcidId,
          type: 'Person',
          label: `${given} ${family}`.trim(),
        };
      },
    },
  ],

  callbacks: {
    signIn({ user }) {
      // Allow sign-in if user is on ANY project's ORCID allowlist
      const userId = user.id;
      const orcidNumber = userId.replace('https://orcid.org/', '');

      // Check legacy global allowlist first (backward compatibility)
      const globalAllowlist = (process.env.ORCID_ALLOWLIST ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);

      if (
        globalAllowlist.includes(userId) ||
        globalAllowlist.includes(orcidNumber)
      ) {
        return true;
      }

      // Check per-project allowlists
      const projects = getAllProjects();
      for (const project of projects) {
        const projectAllowlist = (
          process.env[project.orcidAllowlistEnvVar] ?? ''
        )
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean);

        if (
          projectAllowlist.includes(userId) ||
          projectAllowlist.includes(orcidNumber)
        ) {
          return true;
        }
      }

      return false;
    },

    jwt({ token, user, account }) {
      if (account?.access_token) {
        (token as Record<string, unknown>).accessToken = account.access_token;
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (user !== null && user !== undefined) {
        (token as Record<string, unknown>).label = (user as CustomUser).label;
      }

      return token;
    },

    session({ session, token }) {
      const customSession = {
        ...session,
        user: {
          id: (token.sub as string | null) ?? '',
          type: 'Person',
          label:
            ((token as Record<string, unknown>).label as string | undefined) ??
            '',
        },
        accessToken:
          ((token as Record<string, unknown>).accessToken as
            | string
            | undefined) ?? '',
      };

      return customSession as typeof session;
    },
  },

  pages: {
    signIn: '/',
    error: '/unauthorized',
  },

  secret: process.env.NEXTAUTH_SECRET!,
};
