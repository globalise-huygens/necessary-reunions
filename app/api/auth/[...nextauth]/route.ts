import NextAuth from "next-auth/next";
import type { NextAuthOptions } from "next-auth"
import type { OAuthConfig } from "next-auth/providers";

const isDev = process.env.NODE_ENV === "development";
const issuer = isDev ? "https://sandbox.orcid.org" : "https://orcid.org";

interface ORCIDProfile {
  sub: string;
  given_name: string;
  family_name: string;
}

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "orcid",
      name: "ORCID",
      type: "oauth",
      wellKnown: `${issuer}/.well-known/openid-configuration`,
      authorization: { params: { scope: "openid" } },
      idToken: true,
      userinfo: `${issuer}/oauth/userinfo`,
      clientId: isDev ? process.env.ORCID_DEV_ID! : process.env.ORCID_ID!,
      clientSecret: isDev
        ? process.env.ORCID_DEV_SECRET!
        : process.env.ORCID_SECRET!,

      profile(profile: ORCIDProfile) {
        return {
          id: profile.sub,
          name: `${profile.given_name} ${profile.family_name}`.trim(),
          familyName: profile.family_name,
          givenName: profile.given_name,
        };
      },
    } as OAuthConfig<ORCIDProfile>,
  ],

  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        token.sub = (profile as ORCIDProfile).sub;
        token.role = "editor";
      }
      return token;
    },

    async session({ session, token }) {
      const user = session.user || {};
      return {
        ...session,
        user: {
          ...user,
          id: token.sub as string,
          role: token.role as string,
        },
      };
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: isDev,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
