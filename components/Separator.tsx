'use client';

import React from 'react';
import * as RadixSeparator from '@radix-ui/react-separator';
import { cn } from '@/lib/utils';

type SeparatorProps = React.ComponentPropsWithoutRef<
  typeof RadixSeparator.Root
>;

export const Separator = React.forwardRef<
  React.ElementRef<typeof RadixSeparator.Root>,
  SeparatorProps
>(
  (
    { className, orientation = 'horizontal', decorative = true, ...props },
    ref,
  ) => (
    <RadixSeparator.Root
      ref={ref}
      orientation={orientation}
      decorative={decorative}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className,
      )}
      {...props}
    />
  ),
);
Separator.displayName = RadixSeparator.Root.displayName;
