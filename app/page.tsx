import { ManifestViewer } from '@/components/ManifestViewer';

export default async function Home() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ManifestViewer />
    </div>
  );
}
