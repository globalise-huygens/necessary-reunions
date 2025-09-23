'use client';

import OrcidAuth from '@/components/OrcidAuth';
import { Button } from '@/components/shared/Button';
import { Code, PanelLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SectionConfig {
  title: string;
  hasLogo: boolean;
  logoSrc?: string;
  showAuth: boolean;
  description?: string;
  links: Array<{
    href: string;
    label: string;
  }>;
}

interface UnifiedHeaderProps {
  gavocSidebarToggle?: {
    isVisible: boolean;
    onToggle: () => void;
  };
}

const sectionConfigs: Record<string, SectionConfig> = {
  '/': {
    title: 'Necessary Reunions',
    hasLogo: false,
    showAuth: false,
    links: [{ href: '/about', label: 'About' }],
  },
  '/gazetteer': {
    title: 'Gazetteer',
    hasLogo: false,
    showAuth: false,
    links: [{ href: '/', label: 'Necessary Reunions' }],
  },
  '/gavoc': {
    title: 'Grote Atlas Explorer',
    hasLogo: false,
    showAuth: false,
    description:
      'Geographic Data Visualization & Cartographic Analysis of Early Modern Kerala',
    links: [{ href: '/api/gavoc', label: 'API' }],
  },
};

export function UnifiedHeader({ gavocSidebarToggle }: UnifiedHeaderProps = {}) {
  const pathname = usePathname();

  if (pathname.startsWith('/viewer')) {
    return null;
  }

  if (pathname.startsWith('/gavoc') && !gavocSidebarToggle) {
    return null;
  }

  const getCurrentConfig = (): SectionConfig => {
    if (pathname.startsWith('/gazetteer')) return sectionConfigs['/gazetteer'];
    if (pathname.startsWith('/gavoc')) return sectionConfigs['/gavoc'];
    return sectionConfigs['/'];
  };

  const config = getCurrentConfig();

  const getLinkClassName = (href: string) => {
    const isActive =
      (href === '/' && (pathname === '/' || pathname.startsWith('/about'))) ||
      (href === '/viewer' && pathname.startsWith('/viewer')) ||
      (href === '/gazetteer' && pathname.startsWith('/gazetteer')) ||
      (href === '/gavoc' && pathname.startsWith('/gavoc'));

    return isActive
      ? 'text-sm font-semibold text-primary px-2 py-1 rounded bg-gray-50'
      : 'text-sm font-medium text-gray-600 hover:text-primary px-2 py-1 rounded hover:bg-gray-50';
  };

  return (
    <>
      {/* Main Navigation - always visible */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-2 sm:px-4 py-2">
          <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2">
            <div className="flex items-center space-x-4">
              <Link href="/" className={getLinkClassName('/')}>
                Necessary Reunions
              </Link>
              <Link href="/viewer" className={getLinkClassName('/viewer')}>
                re:Charted
              </Link>
              <Link
                href="/gazetteer"
                className={getLinkClassName('/gazetteer')}
              >
                Gazetteer
              </Link>
              <Link href="/gavoc" className={getLinkClassName('/gavoc')}>
                Grote Atlas
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Section-specific header */}
      <header className="bg-primary text-primary-foreground border-b border-border">
        <div className="w-full px-2 sm:px-4 flex flex-row items-center justify-between py-1 gap-2 sm:gap-0 min-h-0">
          <div className="flex items-center space-x-2 w-auto justify-center sm:justify-start">
            {config.hasLogo && config.logoSrc && (
              <Link
                href={pathname.startsWith('/viewer') ? '/viewer' : '/'}
                aria-label="Home"
              >
                <Image
                  src={config.logoSrc}
                  alt={`${config.title} Logo`}
                  className="h-8 w-8"
                  width={32}
                  height={32}
                />
              </Link>
            )}
            {/* GAVOC-specific layout with sidebar toggle */}
            {pathname.startsWith('/gavoc') && gavocSidebarToggle ? (
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={gavocSidebarToggle.onToggle}
                  className="h-8 w-8 text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
                  title={
                    gavocSidebarToggle.isVisible
                      ? 'Hide sidebar'
                      : 'Show sidebar'
                  }
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
                <div className="flex flex-col">
                  <h1 className="text-xl font-heading text-white leading-tight">
                    {config.title}
                  </h1>
                  {config.description && (
                    <p className="text-sm text-primary-foreground/80 leading-tight">
                      {config.description}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-xl hidden sm:block font-heading text-white">
                  {config.title}
                </h1>
                {config.description && (
                  <p className="text-sm text-primary-foreground/80 hidden sm:block mt-1">
                    {config.description}
                  </p>
                )}
              </>
            )}
          </div>
          <nav aria-label="Section" className="w-auto flex justify-end">
            <ul className="flex space-x-4 items-center">
              {config.showAuth && (
                <li>
                  <OrcidAuth />
                </li>
              )}
              {config.links.map((link) => (
                <li key={link.href} className="hidden sm:block">
                  {pathname.startsWith('/gavoc') && link.label === 'API' ? (
                    <Link
                      href={link.href}
                      className="inline-flex items-center space-x-1 font-medium text-white hover:text-secondary px-3 py-1.5 rounded-md bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Code className="h-4 w-4" />
                      <span>{link.label}</span>
                    </Link>
                  ) : (
                    <Link
                      href={link.href}
                      className="font-medium text-white hover:text-secondary"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
    </>
  );
}
