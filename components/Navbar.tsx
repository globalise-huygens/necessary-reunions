'use client';

import React from 'react';
import { Button } from '@/components/Button';
import { PanelLeft, PanelRight } from 'lucide-react';
import { getLocalizedValue } from '@/lib/iiif-helpers';

interface TopNavigationProps {
  manifest: any;
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
}

export function TopNavigation({
  manifest,
  onToggleLeftSidebar,
  onToggleRightSidebar,
}: TopNavigationProps) {
  const title = getLocalizedValue(manifest.label) || 'Untitled Manifest';

  return (
    <div className="border-b flex items-center justify-between px-2 sm:px-4 py-2">
      <div className="flex items-center gap-2 sm:gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleLeftSidebar}
          className="h-8 w-8 sm:h-10 sm:w-10"
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
        <span className="font-medium truncate max-w-[120px] sm:max-w-md text-base sm:text-lg">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleRightSidebar}
          className="h-8 w-8 sm:h-10 sm:w-10 hidden sm:inline-flex"
        >
          <PanelRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
