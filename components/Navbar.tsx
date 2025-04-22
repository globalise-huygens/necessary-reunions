'use client';

import { Button } from '@/components/ui/button';
import { PanelLeft, PanelRight } from 'lucide-react';
import { getLocalizedValue } from '@/lib/iiif-helpers';

interface TopNavigationProps {
  manifest: any;
  onSave?: () => void;
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
}

export function TopNavigation({
  manifest,
  onToggleLeftSidebar,
  onToggleRightSidebar,
}: TopNavigationProps) {
  const manifestLabel =
    getLocalizedValue(manifest.label) || 'Untitled Manifest';

  return (
    <div className="border-b flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onToggleLeftSidebar}>
          <PanelLeft className="h-5 w-5" />
        </Button>

        <div className="font-medium truncate max-w-md">{manifestLabel}</div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={onToggleRightSidebar}>
          <PanelRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
