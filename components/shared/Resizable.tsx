'use client';

import React from 'react';
import { GripVertical } from 'lucide-react';
import * as Panels from 'react-resizable-panels';
import { cn } from '@/lib/shared/utils';

type PanelGroupProps = React.ComponentProps<typeof Panels.PanelGroup>;
export const ResizablePanelGroup: React.FC<PanelGroupProps> = ({
  className,
  ...props
}) => (
  <Panels.PanelGroup
    className={cn(
      'flex h-full w-full data-[panel-group-direction=vertical]:flex-col',
      className,
    )}
    {...props}
  />
);

export const ResizablePanel = Panels.Panel;

type HandleProps = React.ComponentProps<typeof Panels.PanelResizeHandle> & {
  withHandle?: boolean;
};
export const ResizableHandle: React.FC<HandleProps> = ({
  withHandle,
  className,
  ...props
}) => (
  <Panels.PanelResizeHandle
    className={cn(
      'relative flex items-center justify-center bg-border',
      'data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:h-px',
      'w-px [&[data-panel-group-direction=vertical]>div]:rotate-90',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1',
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </Panels.PanelResizeHandle>
);
