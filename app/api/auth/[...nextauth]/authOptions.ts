import type { NextAuthOptions } from 'next-auth';

interface OrcidProfile {
  sub: string;
  given_name?: string;
  family_name?: string;
  [key: string]: unknown;
}

interface CustomUser {
  id: string;
  type: string;
  label: string;
}

interface ExtendedToken {
  sub?: string;
  label?: string;
  accessToken?: string;
  [key: string]: unknown;
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
      const extendedToken = token as ExtendedToken;
      if (account?.access_token) {
        extendedToken.accessToken = account.access_token;
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (user) {
        extendedToken.sub = user.id;
        extendedToken.label = (user as CustomUser).label;
      }
      return extendedToken;
    },

    session({ session, token }) {
      const extendedToken = token as ExtendedToken;
      // NextAuth typing doesn't support custom session properties
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return {
        ...session,
        user: {
          ...(session.user as object),
          id: token.sub as string,
          type: 'Person',
          label: extendedToken.label as string,
        },
        accessToken: extendedToken.accessToken as string,
      } as any;
    },
  },

  pages: {
    signIn: '/',
    error: '/unauthorized',
  },

  secret: process.env.NEXTAUTH_SECRET!,
};
