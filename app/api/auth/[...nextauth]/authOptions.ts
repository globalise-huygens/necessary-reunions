import type { NextAuthOptions } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

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
      profile(profile) {
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
    async signIn({ user }) {
      const allowlist = (process.env.ORCID_ALLOWLIST ?? '')
        .split(',')
        .map((id) => id.trim());

      const userId = user.id;
      const orcidNumber = userId.replace('https://orcid.org/', '');

      const allowed =
        allowlist.includes(userId) || allowlist.includes(orcidNumber);
      return allowed;
    },

    async jwt({ token, user, account }) {
      if (account?.access_token) {
        (token as any).accessToken = account.access_token;
      }
      if (user) {
        token.sub = user.id;
        (token as any).label = (user as any).label;
      }
      return token;
    },

    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...(session.user as object),
          id: token.sub as string,
          type: 'Person',
          label: (token as any).label as string,
        },
        accessToken: (token as any).accessToken as string,
      } as any;
    },
  },

  pages: {
    signIn: '/',
    error: '/unauthorized',
  },

  secret: process.env.NEXTAUTH_SECRET!,
};
