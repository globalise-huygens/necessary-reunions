import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const res = await fetch('https://orcid.org/oauth/userinfo', {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  if (!res.ok) {
    return new Response('Failed to fetch userinfo', { status: res.status });
  }

  const profile = await res.json();

  const minimal = {
    id: profile.sub,
    type: 'Person',
    'label/name': profile.name,
  };

  return new Response(JSON.stringify(minimal), {
    headers: { 'Content-Type': 'application/json' },
  });
}
