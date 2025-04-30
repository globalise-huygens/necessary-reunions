export const authOptions = {
  providers: [
    {
      id: 'orcid',
      name: 'ORCID',
      type: 'oauth',
      clientId: process.env.ORCID_CLIENT_ID,
      clientSecret: process.env.ORCID_CLIENT_SECRET,
      authorization: {
        url: 'https://orcid.org/oauth/authorize',
        params: {
          scope: '/authenticate',
          response_type: 'code',
          redirect_uri: process.env.NEXTAUTH_URL + '/api/auth/callback/orcid',
        },
      },
      token: 'https://orcid.org/oauth/token',
      userinfo: {
        url: 'https://pub.orcid.org/v3.0/[ORCID]',
        async request({ tokens }) {
          const res = await fetch(
            `https://pub.orcid.org/v3.0/${tokens.orcid}`,
            {
              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                Accept: 'application/json',
              },
            },
          );
          return await res.json();
        },
      },
      profile(profile) {
        return {
          id: profile['orcid-identifier'].path,
          name:
            profile.person?.name?.['given-names']?.value +
            ' ' +
            profile.person?.name?.['family-name']?.value,
          email: profile.person?.emails?.email?.[0]?.email,
        };
      },
    },
  ],
  pages: {
    signIn: '/',
    error: '/',
  },
  callbacks: {
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.user.id = token.orcid;
      return session;
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.orcid = account.orcid;
      }
      return token;
    },
  },
};
