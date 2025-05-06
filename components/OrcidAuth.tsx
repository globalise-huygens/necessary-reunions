'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { LogIn, LogOut } from 'lucide-react';
import { Button } from './Button';

interface SessionUser {
  id: string;
  label: string;
}

interface SessionData {
  user: SessionUser;
  accessToken: string;
}

export default function OrcidAuth() {
  const { data: session } = useSession() as { data: SessionData | null };

  return (
    <div className="flex items-center space-x-3">
      {!session ? (
        <Button
          onClick={() =>
            signIn('orcid', {
              callbackUrl: window.location.origin,
            })
          }
          variant={'secondary'}
        >
          <LogIn className="h-4 w-4 mr-1" />
          Sign in
        </Button>
      ) : (
        <>
          <span className="text-sm text-white">
            {session.user.label}
            <br />
            <small>ORCID: {session.user.id}</small>
          </span>
          <Button
            onClick={() => signOut()}
            variant={'default'}
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
