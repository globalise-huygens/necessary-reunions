import type { NextAuthOptions, User } from 'next-auth';

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
      const allowlist = (process.env.ORCID_ALLOWLIST ?? '')
        .split(',')
        .map((id) => id.trim());

      const userId = user.id;
      const orcidNumber = userId.replace('https://orcid.org/', '');

      const allowed =
        allowlist.includes(userId) || allowlist.includes(orcidNumber);
      return allowed;
    },

    jwt({ token, user, account }) {
      if (account?.access_token) {
        (token as Record<string, unknown>).accessToken = account.access_token;
      }

      // User is only defined on initial signin, not on token refresh
      // TypeScript types don't reflect this but it's true at runtime
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
