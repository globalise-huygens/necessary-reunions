'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { LogIn, LogOut } from 'lucide-react';
import { Button } from './Button';
import { LoadingSpinner } from './LoadingSpinner';

interface SessionUser {
  id: string;
  label: string;
}

interface SessionData {
  user: SessionUser;
  accessToken: string;
}

export default function OrcidAuth() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-10">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-1 sm:space-x-3">
      {!session ? (
        <Button
          onClick={() =>
            signIn('orcid', { callbackUrl: window.location.origin })
          }
          variant="secondary"
          aria-label="Sign in with ORCID"
          className="p-2 h-8 w-8 flex items-center justify-center"
        >
          <LogIn className="h-5 w-5" />
        </Button>
      ) : (
        <Button
          onClick={() => signOut()}
          variant="default"
          aria-label="Sign out"
          className="p-2 h-8 w-8 flex items-center justify-center"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
