'use client';

import { LinkingCleanupManager } from '@/components/viewer/LinkingCleanupManager';

export default function CleanupPage() {
  return (
    <div className="h-screen overflow-hidden">
      <div className="max-w-7xl mx-auto h-full flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          <LinkingCleanupManager />
        </div>
      </div>
    </div>
  );
}
