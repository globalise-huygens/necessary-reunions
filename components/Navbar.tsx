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
    <div className="border-b flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onToggleLeftSidebar}>
          <PanelLeft className="h-5 w-5" />
        </Button>
        <span className="font-medium truncate max-w-md">{title}</span>
      </div>
      <Button variant="outline" size="icon" onClick={onToggleRightSidebar}>
        <PanelRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
