'use client';

import * as ToastPrimitives from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/shared/utils';

export const ToastProvider = ToastPrimitives.Provider;

export interface ToastViewportProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport> {}
export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  ToastViewportProps
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed top-0 z-[9999] flex w-full flex-col-reverse p-4',
      'sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-md',
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = 'ToastViewport';

export interface ToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> {}
export const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  ToastProps
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(
      'group relative flex items-start gap-4 w-full rounded-md bg-card',
      'text-card-foreground shadow-md p-4 border border-border',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full',
      'data-[state=open]:slide-in-from-top-full sm:data-[state=open]:slide-in-from-bottom-full',
      className,
    )}
    {...props}
  />
));
Toast.displayName = 'Toast';

export interface ToastTitleProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title> {}
export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  ToastTitleProps
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn('text-sm font-medium', className)}
    {...props}
  />
));
ToastTitle.displayName = 'ToastTitle';

export interface ToastDescriptionProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description> {}
export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  ToastDescriptionProps
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
ToastDescription.displayName = 'ToastDescription';

export interface ToastCloseProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close> {}
export const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  ToastCloseProps
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'absolute right-2 top-2 p-1 text-muted-foreground',
      'hover:text-card-foreground focus:outline-none',
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = 'ToastClose';

export interface ToastActionProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action> {}
export const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  ToastActionProps
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      'inline-flex h-8 items-center justify-center rounded-md',
      'border bg-muted/50 px-3 text-sm font-medium hover:bg-muted',
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = 'ToastAction';

export type ToastActionElement = React.ReactElement<typeof ToastAction>;
