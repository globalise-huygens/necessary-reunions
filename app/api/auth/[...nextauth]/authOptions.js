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
        return {
          id: profile.sub,
          type: 'Person',
          'label/name': profile.name,
        };
      },
    },
  ],

  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      if (profile?.sub) {
        token.sub = profile.sub;
        token.name = profile.name;
      }
      return token;
    },

    async session({ session, token }) {
      session.user = {
        id: token.sub,
        type: 'Person',
        'label/name': token.name,
      };
      session.accessToken = token.accessToken;
      return session;
    },
  },

  pages: {
    signIn: '/',
    error: '/',
  },

  secret: process.env.NEXTAUTH_SECRET,
};
