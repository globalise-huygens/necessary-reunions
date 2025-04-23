import { ManifestViewer } from '@/components/ManifestViewer';

export default function Home() {
  return (
    <div className="h-screen flex flex-col">
      <h1 className="text-xl font-bold p-4 border-b">
        IIIF Manifest Viewer & Editor
      </h1>
      <ManifestViewer />
    </div>
  );
}
