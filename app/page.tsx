import { ManifestViewer } from '@/components/ManifestViewer';
import MyData from '@/components/MyData';

export default async function Home() {
  return (
    <div className="h-screen flex flex-col p-6">
      <h1 className="text-xl font-bold p-4 border-b">
        IIIF Manifest Viewer & Editor
      </h1>
      <ManifestViewer />
      <MyData />
    </div>
  );
}
