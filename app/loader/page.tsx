'use client';

import { ManifestViewer } from '@/components/viewer/ManifestViewer';
import { useRouter } from 'next/navigation';

export default function LoaderPage() {
  const router = useRouter();

  const handleClose = () => {
    router.push('/');
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ManifestViewer
        showManifestLoader={true}
        onManifestLoaderClose={handleClose}
      />
    </div>
  );
}
