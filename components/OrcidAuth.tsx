'use client';

import { LogIn, LogOut } from 'lucide-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { Button } from '../components/shared/Button';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';

interface SessionUser {
  id: string;
  label: string;
}

export default function OrcidAuth() {
  const { data: session, status } = useSession();

  const getOrcidDisplayId = (id: string) => {
    if (id.startsWith('https://orcid.org/')) {
      return id.replace('https://orcid.org/', '');
    }
    return id;
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-10">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3">
      {!session ? (
        <Button onClick={() => signIn('orcid')} variant="secondary">
          <LogIn className="h-4 w-4 mr-1" />
          Sign in
        </Button>
      ) : (
        <>
          <span className="text-sm text-white">
            {(session.user as SessionUser).label}
            <br />
            <small className="hidden sm:block">
              ORCID: {getOrcidDisplayId((session.user as SessionUser).id)}
            </small>
          </span>
          <Button
            onClick={() => signOut()}
            variant="default"
            className="hover:text-secondary"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Sign out
          </Button>
        </>
      )}
    </div>
  );
}
