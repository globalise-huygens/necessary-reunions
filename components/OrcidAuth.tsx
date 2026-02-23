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
      <div className="flex items-center justify-center h-5 sm:h-10">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:space-x-3">
      {!session ? (
        <Button
          onClick={() => signIn('orcid')}
          variant="secondary"
          className="h-5 w-5 p-0 sm:h-9 sm:w-auto sm:px-3 sm:text-sm"
          title="Sign in with ORCID"
        >
          <LogIn className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
          <span className="hidden sm:inline">Sign in</span>
        </Button>
      ) : (
        <>
          <span className="hidden sm:inline text-sm text-white leading-tight">
            {(session.user as SessionUser).label}
            <br />
            <small className="hidden sm:block">
              ORCID: {getOrcidDisplayId((session.user as SessionUser).id)}
            </small>
          </span>
          <Button
            onClick={() => signOut()}
            variant="default"
            className="h-5 w-5 p-0 sm:h-9 sm:w-auto sm:px-3 sm:text-sm hover:text-secondary"
            title="Sign out"
          >
            <LogOut className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </>
      )}
    </div>
  );
}
