// next-auth.d.ts
import NextAuth, { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  /**
   * Returned by `getSession()` and `useSession()`
   */
  interface Session {
    user: {
      /** The user's ORCID iD */
      id: string;
      /** The role we stashed in the JWT */
      role: string;
    } & DefaultSession['user'];
  }
}
