'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  forwardRef,
} from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Button } from '@/components/Button';
import { Sheet, SheetContent } from '@/components/Sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { PanelLeft } from 'lucide-react';

interface SidebarContextType {
  state: string;
  setOpen: (v: boolean) => void;
  isMobile: boolean;
  openMobile: boolean;
  setOpenMobile: React.Dispatch<React.SetStateAction<boolean>>;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);
export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error();
  return ctx;
}

interface SidebarProviderProps {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children: React.ReactNode;
  [key: string]: any;
}

export const SidebarProvider = forwardRef<HTMLDivElement, SidebarProviderProps>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isMobile = useIsMobile();
    const [openMobile, setOpenMobile] = useState(false);
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const open = openProp ?? internalOpen;
    const setOpen = useCallback(
      (v: boolean) => {
        onOpenChange ? onOpenChange(v) : setInternalOpen(v);
      },
      [onOpenChange],
    );
    const toggle: () => void = useCallback(
      () =>
        isMobile
          ? setOpenMobile((prev: boolean) => !prev)
          : setInternalOpen((prev: boolean) => !prev),
      [isMobile, setOpen],
    );
    useEffect(() => {
      const h = (e: KeyboardEvent) =>
        e.key === 'b' && (e.metaKey || e.ctrlKey) && toggle();
      window.addEventListener('keydown', h);
      return () => window.removeEventListener('keydown', h);
    }, [toggle]);
    const state = open ? 'expanded' : 'collapsed';
    const value = useMemo(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggle,
      }),
      [state, open, isMobile, openMobile, toggle],
    );
    return (
      <SidebarContext.Provider value={value}>
        <div
          ref={ref}
          className={cn('flex h-full w-full', className)}
          {...props}
        >
          {children}
        </div>
      </SidebarContext.Provider>
    );
  },
);
SidebarProvider.displayName = 'SidebarProvider';

// Sidebar
interface SidebarProps {
  side?: 'left' | 'right';
  variant?: string;
  collapsible?: string;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

export const Sidebar = forwardRef<HTMLDivElement, SidebarProps>(
  (
    {
      side = 'left',
      variant = 'sidebar',
      collapsible = 'offcanvas',
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar();
    if (collapsible === 'none')
      return (
        <div
          ref={ref}
          className={cn('flex h-full w-64 flex-col', className)}
          {...props}
        >
          {children}
        </div>
      );
    if (isMobile)
      return (
        <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
          <SheetContent side={side} className="w-64 p-0">
            {children}
          </SheetContent>
        </Sheet>
      );
    return (
      <div
        ref={ref}
        data-state={state}
        data-variant={variant}
        className={cn(
          'fixed h-full',
          side === 'left' ? 'left-0' : 'right-0',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Sidebar.displayName = 'Sidebar';

export const SidebarTrigger = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<'button'>
>(({ className, ...props }, ref) => {
  const { toggle } = useSidebar();
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7', className)}
      onClick={toggle}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
});
SidebarTrigger.displayName = 'SidebarTrigger';

// Simple menu button
interface SidebarMenuButtonProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
  isActive?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const SidebarMenuButton = forwardRef<any, SidebarMenuButtonProps>(
  (
    { asChild = false, isActive = false, className, children, ...props },
    ref,
  ) => {
    const Comp: React.ElementType = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        data-active={isActive}
        className={cn('flex w-full items-center p-2 text-left', className)}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);
SidebarMenuButton.displayName = 'SidebarMenuButton';
