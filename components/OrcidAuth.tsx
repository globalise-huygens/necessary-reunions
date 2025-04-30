'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { LogIn, LogOut } from 'lucide-react';

export default function OrcidAuth() {
  const { data: session } = useSession() as {
    data: {
      user: { id: string; name?: string | null };
      accessToken: string;
    } | null;
  };

  const fetchData = async () => {
    if (!session?.user) return;
    const res = await fetch(`/api/orcid/${session.user.id}`);
    console.log(await res.json());
  };

  return (
    <div className="flex items-center space-x-3">
      {!session ? (
        <button
          onClick={() => signIn('orcid')}
          className="flex items-center px-3 py-1 bg-gray-100 rounded-md hover:bg-gray-200 transition"
        >
          <LogIn className="h-4 w-4 mr-1" />
          Sign in
        </button>
      ) : (
        <>
          <span className="text-sm">
            {session.user.name}
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
