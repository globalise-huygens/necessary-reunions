'use client';

import { Suspense } from 'react';
import { ManifestViewer } from '../../components/viewer/ManifestViewer';
import { ProjectProvider } from '../../lib/viewer/project-context';

function ViewerContent() {
  return (
    <ProjectProvider>
      <div className="h-full flex flex-col overflow-hidden">
        <ManifestViewer />
      </div>
    </ProjectProvider>
  );
}

export default function ReChartedApp() {
  return (
    <Suspense
      fallback={<div className="h-full flex flex-col overflow-hidden" />}
    >
      <ViewerContent />
    </Suspense>
  );
}
