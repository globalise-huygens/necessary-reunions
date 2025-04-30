import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]/route';
import { ManifestViewer } from '@/components/ManifestViewer';

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/api/auth/signin');
  return (
    <div className="h-screen flex flex-col">
      <ManifestViewer />
    </div>
  );
}
