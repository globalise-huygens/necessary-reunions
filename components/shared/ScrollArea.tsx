'use client';

import * as RadixScroll from '@radix-ui/react-scroll-area';
import React from 'react';
import { cn } from '../../lib/shared/utils';

type ScrollBarProps = React.ComponentPropsWithoutRef<
  typeof RadixScroll.ScrollAreaScrollbar
>;
export const ScrollBar = React.forwardRef<
  React.ElementRef<typeof RadixScroll.ScrollAreaScrollbar>,
  ScrollBarProps
>(({ className, orientation = 'vertical', ...props }, ref) => (
  <RadixScroll.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'flex touch-none select-none transition-colors',
      orientation === 'vertical'
        ? 'h-full w-2.5 border-l border-l-transparent p-[1px]'
        : 'h-2.5 flex-col border-t border-t-transparent p-[1px]',
      className,
    )}
    {...props}
  >
    <RadixScroll.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </RadixScroll.ScrollAreaScrollbar>
));
ScrollBar.displayName = RadixScroll.ScrollAreaScrollbar.displayName;

type ScrollAreaProps = React.ComponentPropsWithoutRef<typeof RadixScroll.Root>;
export const ScrollArea = React.forwardRef<
  React.ElementRef<typeof RadixScroll.Root>,
  ScrollAreaProps
>(({ className, children, ...props }, ref) => (
  <RadixScroll.Root
    ref={ref}
    className={cn('relative overflow-hidden', className)}
    {...props}
  >
    <RadixScroll.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </RadixScroll.Viewport>
    <ScrollBar />
    <RadixScroll.Corner />
  </RadixScroll.Root>
));
ScrollArea.displayName = RadixScroll.Root.displayName;
