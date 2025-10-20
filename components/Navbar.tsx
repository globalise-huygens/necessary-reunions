'use client';

import { Folder, PanelLeft, PanelRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import OrcidAuth from '../components/OrcidAuth';
import { Button } from '../components/shared/Button';
import { useIsMobile } from '../hooks/use-mobile';
import { getLocalizedValue } from '../lib/viewer/iiif-helpers';

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

  return (
    <>
      {/* Project Navigation Bar - matching the unified design */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-2 sm:px-4 py-2">
          <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="text-sm font-medium text-gray-600 hover:text-primary px-2 py-1 rounded hover:bg-gray-50"
              >
                Necessary Reunions
              </Link>
              <Link
                href="/viewer"
                className="text-sm font-semibold text-primary px-2 py-1 rounded bg-gray-50"
              >
                re:Charted
              </Link>
              <Link
                href="/gazetteer"
                className="text-sm font-medium text-gray-600 hover:text-primary px-2 py-1 rounded hover:bg-gray-50"
              >
                Gazetteer
              </Link>
              <Link
                href="/gavoc"
                className="text-sm font-medium text-gray-600 hover:text-primary px-2 py-1 rounded hover:bg-gray-50"
              >
                GAVOC
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Section-specific header - re:Charted branded */}
      <header className="bg-primary text-primary-foreground border-b border-border">
        <div className="w-full px-2 sm:px-4 flex flex-row items-center justify-between py-2 gap-2 sm:gap-0">
          <div className="flex items-center space-x-2 w-auto justify-center sm:justify-start">
            {!isMobile && (
              <Button
                variant="outline"
                size="icon"
                onClick={onToggleLeftSidebar}
                className="h-8 w-8 sm:h-10 sm:w-10 mr-3 bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              >
                <PanelLeft className="h-5 w-5" />
              </Button>
            )}
            <Image
              src="/image/recharted-logo.png"
              alt="re:Charted Logo"
              className="h-6 w-6 sm:h-8 sm:w-8"
              width={32}
              height={32}
            />
            <div>
              <h1 className="text-lg sm:text-xl font-heading text-white">
                re:Charted
              </h1>
              <span className="text-xs text-primary-foreground/80 truncate max-w-[120px] sm:max-w-md">
                {title}
              </span>
            </div>
          </div>
          <nav aria-label="Section" className="w-auto flex justify-end">
            <ul className="flex space-x-4 items-center">
              <li>
                <OrcidAuth />
              </li>
              {onOpenManifestLoader && (
                <li>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenManifestLoader}
                    className="h-8 px-2 sm:h-10 sm:px-3 bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                    title="Switch to a different manifest"
                  >
                    <Folder className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Switch Manifest</span>
                  </Button>
                </li>
              )}
              {!isMobile && (
                <li>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onToggleRightSidebar}
                    className="h-8 w-8 sm:h-10 sm:w-10 hidden sm:inline-flex bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                  >
                    <PanelRight className="h-5 w-5" />
                  </Button>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </header>
    </>
  );
}
