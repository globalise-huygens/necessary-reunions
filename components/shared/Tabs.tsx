// @ts-nocheck
'use client';

import { cn } from '@/lib/shared/utils';
import * as RadixTabs from '@radix-ui/react-tabs';
import * as React from 'react';

export type TabsProps = React.ComponentPropsWithoutRef<typeof RadixTabs.Root>;
export const Tabs = RadixTabs.Root;

export type TabsListProps = React.ComponentPropsWithoutRef<
  typeof RadixTabs.List
>;
export const TabsList = React.forwardRef<
  React.ElementRef<typeof RadixTabs.List>,
  TabsListProps
>(({ className, ...props }, ref) => (
  <RadixTabs.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = RadixTabs.List.displayName;

export type TabsTriggerProps = React.ComponentPropsWithoutRef<
  typeof RadixTabs.Trigger
>;
export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof RadixTabs.Trigger>,
  TabsTriggerProps
>(({ className, ...props }, ref) => (
  <RadixTabs.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium',
      'ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = RadixTabs.Trigger.displayName;

export type TabsContentProps = React.ComponentPropsWithoutRef<
  typeof RadixTabs.Content
>;
export const TabsContent = React.forwardRef<
  React.ElementRef<typeof RadixTabs.Content>,
  TabsContentProps
>(({ className, ...props }, ref) => (
  <RadixTabs.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = RadixTabs.Content.displayName;
