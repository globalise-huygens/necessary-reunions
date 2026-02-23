'use client';

import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown } from 'lucide-react';
import React, { useState } from 'react';
import type { ProjectConfig } from '../../lib/projects';
import { cn } from '../../lib/shared/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../shared/Sheet';

interface ProjectSwitcherProps {
  currentSlug: string;
  projects: ProjectConfig[];
  onSwitch: (slug: string) => void;
  isMobile: boolean;
}

/**
 * Small colour dot indicating the project identity.
 */
function AccentDot({ className }: { className: string }) {
  return <span className={cn('h-2 w-2 shrink-0 rounded-full', className)} />;
}

/**
 * Shared project list used inside both the popover and the sheet.
 */
function ProjectList({
  projects,
  currentSlug,
  onSelect,
}: {
  projects: ProjectConfig[];
  currentSlug: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <div role="listbox" aria-label="Available projects" className="space-y-1">
      {projects.map((p) => {
        const isActive = p.slug === currentSlug;
        return (
          <button
            key={`project-option-${p.slug}`}
            type="button"
            role="option"
            aria-selected={isActive}
            onClick={() => onSelect(p.slug)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5',
              'min-h-[44px] text-left transition-colors',
              isActive
                ? 'bg-primary/10 ring-1 ring-primary/20'
                : 'hover:bg-muted',
            )}
          >
            <AccentDot className={p.accentColor} />
            <span className="flex-1 text-sm font-medium text-foreground">
              {p.label}
            </span>
            {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Desktop: Popover dropdown anchored to the project name trigger    */
/* ------------------------------------------------------------------ */

function DesktopSwitcher({
  currentSlug,
  projects,
  onSwitch,
}: Omit<ProjectSwitcherProps, 'isMobile'>) {
  const [open, setOpen] = useState(false);
  const current = projects.find((p) => p.slug === currentSlug) ?? projects[0];
  if (!current) return null;

  function handleSelect(slug: string) {
    setOpen(false);
    if (slug !== currentSlug) onSwitch(slug);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Switch project"
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5',
            'text-[10px] sm:text-xs font-medium text-primary-foreground/90',
            'hover:bg-primary-foreground/10 transition-colors',
          )}
        >
          <AccentDot className={current.accentColor} />
          {current.shortLabel}
          <ChevronDown className="h-2.5 w-2.5 sm:h-3 sm:w-3 opacity-60" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className={cn(
            'z-[200] w-56 rounded-lg border bg-popover p-1.5 shadow-lg',
            'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2',
          )}
        >
          <ProjectList
            projects={projects}
            currentSlug={currentSlug}
            onSelect={handleSelect}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile: Bottom sheet with large touch targets                     */
/* ------------------------------------------------------------------ */

function MobileSwitcher({
  currentSlug,
  projects,
  onSwitch,
}: Omit<ProjectSwitcherProps, 'isMobile'>) {
  const [open, setOpen] = useState(false);
  const current = projects.find((p) => p.slug === currentSlug) ?? projects[0];
  if (!current) return null;

  function handleSelect(slug: string) {
    setOpen(false);
    if (slug !== currentSlug) onSwitch(slug);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Switch project"
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5',
            'text-[10px] sm:text-xs font-medium text-primary-foreground/90',
            'hover:bg-primary-foreground/10 transition-colors',
          )}
        >
          <AccentDot className={current.accentColor} />
          {current.shortLabel}
          <ChevronDown className="h-2.5 w-2.5 sm:h-3 sm:w-3 opacity-60" />
        </button>
      </SheetTrigger>

      <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-8 pt-4">
        <SheetHeader className="mb-3">
          <SheetTitle className="text-base">Switch Project</SheetTitle>
        </SheetHeader>

        <ProjectList
          projects={projects}
          currentSlug={currentSlug}
          onSelect={handleSelect}
        />
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Public component                                                  */
/* ------------------------------------------------------------------ */

export function ProjectSwitcher({
  currentSlug,
  projects,
  onSwitch,
  isMobile,
}: ProjectSwitcherProps) {
  if (projects.length <= 1) return null;

  const shared = { currentSlug, projects, onSwitch };

  return isMobile ? (
    <MobileSwitcher {...shared} />
  ) : (
    <DesktopSwitcher {...shared} />
  );
}
