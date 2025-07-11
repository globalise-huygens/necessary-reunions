'use client';

import { Button } from '@/components/Button';
import { useIsMobile } from '@/hooks/use-mobile';
import { getLocalizedValue } from '@/lib/iiif-helpers';
import { Folder, PanelLeft, PanelRight } from 'lucide-react';
import React from 'react';

interface TopNavigationProps {
  manifest: any;
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
  onOpenManifestLoader?: () => void;
}

export function TopNavigation({
  manifest,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onOpenManifestLoader,
}: TopNavigationProps) {
  const title = getLocalizedValue(manifest.label) || 'Untitled Manifest';
  const isMobile = useIsMobile();

  return (
    <div className="border-b flex items-center justify-between px-2 py-2">
      <div className="flex items-center sm:justify-start md:flex-none">
        {!isMobile && (
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleLeftSidebar}
            className="h-8 w-8 sm:h-10 sm:w-10 mr-3"
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        )}
        <span className="font-medium truncate max-w-[120px] sm:max-w-md text-base sm:text-lg">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {onOpenManifestLoader && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenManifestLoader}
            className="h-8 px-2 sm:h-10 sm:px-3"
            title="Switch to a different manifest"
          >
            <Folder className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Switch Manifest</span>
          </Button>
        )}
        {!isMobile && (
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleRightSidebar}
            className="h-8 w-8 sm:h-10 sm:w-10 hidden sm:inline-flex"
          >
            <PanelRight className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
