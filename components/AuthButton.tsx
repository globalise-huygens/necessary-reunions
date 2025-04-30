'use client';
import { useSession, signIn, signOut } from 'next-auth/react';

export function AuthButton() {
  const { data: session } = useSession();
  return session ? (
    <button onClick={() => signOut()} className="btn">
      Sign out
    </button>
  ) : (
    <button onClick={() => signIn('orcid')} className="btn">
      Sign in with ORCID
    </button>
  );
}
