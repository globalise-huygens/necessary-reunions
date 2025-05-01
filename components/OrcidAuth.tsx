'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { LogIn, LogOut } from 'lucide-react';

interface SessionUser {
  id: string;
  'label/name': string;
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
        <button
          onClick={() =>
            signIn('orcid', {
              callbackUrl: window.location.origin,
            })
          }
          className="flex items-center px-3 py-1 bg-gray-100 rounded-md hover:bg-gray-200 transition"
        >
          <LogIn className="h-4 w-4 mr-1" />
          Sign in
        </button>
      ) : (
        <>
          <span className="text-sm">
            {session.user['label/name']}
            <br />
            <small className="text-gray-500">ORCID: {session.user.id}</small>
          </span>
          <button
            onClick={() => signOut()}
            className="flex items-center px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-100 transition text-sm"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Sign out
          </button>
        </>
      )}
    </div>
  );
}
