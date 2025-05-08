export const authOptions = {
  providers: [
    {
      id: 'orcid',
      name: 'ORCID',
      type: 'oauth',
      version: '2.0',
      wellKnown: 'https://orcid.org/.well-known/openid-configuration',
      clientId: process.env.ORCID_CLIENT_ID,
      clientSecret: process.env.ORCID_CLIENT_SECRET,
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
        return {
          id: profile.sub,
          type: 'Person',
          label: `${given} ${family}`.trim(),
        };
      },
    },
  ],

  callbacks: {
    async signIn({ user }) {
      const allowlist = (process.env.ORCID_ALLOWLIST || '').split(',');
      if (allowlist.includes(user.id)) return true;
      return false;
    },

    async jwt({ token, user, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      if (user) {
        token.sub = user.id;
        token.label = user.label;
      }
      return token;
    },

    async session({ session, token }) {
      session.user = {
        id: token.sub,
        type: 'Person',
        label: token.label,
      };
      session.accessToken = token.accessToken;
      return session;
    },
  },

  pages: {
    signIn: '/',
    error: '/unauthorized',
  },

  secret: process.env.NEXTAUTH_SECRET,
};
