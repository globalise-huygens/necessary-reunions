'use client';

import { Folder, PanelLeft, PanelRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React from 'react';
import OrcidAuth from '../components/OrcidAuth';
import { Button } from '../components/shared/Button';
import { useIsMobile } from '../hooks/use-mobile';
import { getAllProjects } from '../lib/projects';
import { getLocalizedValue } from '../lib/viewer/iiif-helpers';
import { useProjectConfig } from '../lib/viewer/project-context';
import { ProjectSwitcher } from './viewer/ProjectSwitcher';

interface TopNavigationProps {
  manifest?: { label?: any } | null;
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
  const title = getLocalizedValue(manifest?.label) || 'Untitled Manifest';
  const isMobile = useIsMobile();
  const projectConfig = useProjectConfig();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projects = getAllProjects();

  const handleProjectSwitch = (slug: string) => {
    if (slug === projectConfig.slug) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('project', slug);
    router.push(`/viewer?${params.toString()}`);
  };

  return (
    <>
      {/* Site-wide navigation bar */}
      <nav className="bg-card border-b border-border">
        <div className="w-full px-1.5 sm:px-3 py-0.5 sm:py-1">
          <div className="flex items-center justify-center sm:justify-start gap-0.5 sm:gap-2 overflow-x-auto">
            <Link
              href="/"
              className="text-[10px] sm:text-sm font-medium text-muted-foreground hover:text-primary px-1 sm:px-1.5 py-0.5 rounded hover:bg-muted/50 whitespace-nowrap"
            >
              Home
            </Link>
            <Link
              href="/viewer"
              className="text-[10px] sm:text-sm font-semibold text-primary px-1 sm:px-1.5 py-0.5 rounded bg-muted/50 whitespace-nowrap"
            >
              re:Charted
            </Link>
            <Link
              href="/gazetteer"
              className="text-[10px] sm:text-sm font-medium text-muted-foreground hover:text-primary px-1 sm:px-1.5 py-0.5 rounded hover:bg-muted/50 whitespace-nowrap"
            >
              Gazetteer
            </Link>
            <Link
              href="/gavoc"
              className="text-[10px] sm:text-sm font-medium text-muted-foreground hover:text-primary px-1 sm:px-1.5 py-0.5 rounded hover:bg-muted/50 whitespace-nowrap"
            >
              GAVOC
            </Link>
            <Link
              href="/documentation"
              className="text-[10px] sm:text-sm font-medium text-muted-foreground hover:text-primary px-1 sm:px-1.5 py-0.5 rounded hover:bg-muted/50 whitespace-nowrap"
            >
              Docs
            </Link>
          </div>
        </div>
      </nav>

      {/* Section-specific header - re:Charted branded */}
      <header className="bg-primary text-primary-foreground border-b border-border">
        <div className="w-full px-1 sm:px-3 flex items-center justify-between py-1 sm:py-1.5 gap-1">
          {/* Left: sidebar toggle + branding + project switcher */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 overflow-hidden">
            {!isMobile && (
              <Button
                variant="outline"
                size="icon"
                onClick={onToggleLeftSidebar}
                className="h-7 w-7 shrink-0 bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
            <Image
              src="/image/recharted-logo.png"
              alt="re:Charted Logo"
              className="h-4 w-4 sm:h-6 sm:w-6 shrink-0"
              width={24}
              height={24}
            />
            <div className="min-w-0 overflow-hidden">
              <div className="flex items-center gap-0.5 sm:gap-1">
                <h1 className="text-[10px] sm:text-base font-heading text-primary-foreground leading-tight truncate">
                  re:Charted
                </h1>
                <ProjectSwitcher
                  currentSlug={projectConfig.slug}
                  projects={projects}
                  onSwitch={handleProjectSwitch}
                  isMobile={isMobile}
                />
              </div>
              <span className="hidden sm:block text-[11px] leading-tight text-primary-foreground/70 truncate max-w-sm">
                {title}
              </span>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
            <OrcidAuth />
            {onOpenManifestLoader && (
              <Button
                variant="outline"
                size="icon"
                onClick={onOpenManifestLoader}
                className="h-5 w-5 sm:h-7 sm:w-7 bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
                title="Switch to a different manifest"
              >
                <Folder className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
              </Button>
            )}
            {!isMobile && (
              <Button
                variant="outline"
                size="icon"
                onClick={onToggleRightSidebar}
                className="h-7 w-7 bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
