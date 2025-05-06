import { ManifestViewer } from '@/components/ManifestViewer';
import OrcidAuth from '@/components/OrcidAuth';

export default async function Home() {
  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between border-b p-4 bg-gray-50">
        <h1 className="text-2xl font-semibold">
          IIIF Manifest Viewer &amp; Editor
        </h1>
        <OrcidAuth />
      </header>

      <main className="flex-1 overflow-hidden">
        <ManifestViewer />
      </main>
    </div>
  );
}
