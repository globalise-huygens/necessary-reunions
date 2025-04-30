'use client';

import { signIn, signOut, useSession } from 'next-auth/react';

export default function MyData() {
  const { data: session } = useSession() as {
    data: {
      user: { id: string; name?: string | null };
      accessToken: string;
    } | null;
  };

  const fetchData = async () => {
    if (session?.user) {
      const res = await fetch(`/api/orcid/${session.user.id}`);
      const data = await res.json();
      console.log(data);
    }
  };

  return (
    <div className="mt-4">
      {!session ? (
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={() => signIn('orcid')}
        >
          Sign in with ORCID
        </button>
      ) : (
        <div>
          <p>Welcome, {session.user.name}</p>
          <p>ORCID: {session.user.id}</p>
          <p>Access Token: {session.accessToken}</p>
          <button className="mt-2 px-4 py-2 border rounded" onClick={fetchData}>
            Show My ORCID Data
          </button>
          <button
            className="mt-2 px-4 py-2 text-red-600"
            onClick={() => signOut()}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
