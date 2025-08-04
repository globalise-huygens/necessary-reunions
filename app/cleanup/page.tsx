'use client';

import { LinkingCleanupManager } from '@/components/LinkingCleanupManager';

export default function CleanupPage() {
  return (
    <div className="h-full">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 h-full">
        <LinkingCleanupManager />
      </div>
    </div>
  );
}
