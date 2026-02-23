'use client';

import { Code, PanelLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import OrcidAuth from '../components/OrcidAuth';
import { Button } from '../components/shared/Button';

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
    links: [],
  },
  '/gazetteer': {
    title: 'Gazetteer Explorer',
    hasLogo: false,
    showAuth: false,
    description:
      'Historical Place Names Database & Geographic Analysis of Early Modern Kerala',
    links: [{ href: '/', label: 'Necessary Reunions' }],
  },
  '/gavoc': {
    title: 'Grote Atlas Explorer',
    hasLogo: false,
    showAuth: false,
    description:
      'Geographic Data Visualization & Cartographic Analysis of Early Modern Kerala — Based on Schilder et al., Grote atlas van de Verenigde Oost-Indische Compagnie (2006)',
    links: [
      { href: '/api/gavoc', label: 'API' },
      {
        href: 'https://www.nationaalarchief.nl/onderzoeken/archief/2.14.97/invnr/11.1/file/%20001%20VOC-I%20Dig',
        label: 'Source Atlas',
      },
    ],
  },
  '/documentation': {
    title: 'Documentation',
    hasLogo: false,
    showAuth: false,
    description: 'User Guide & Technical Reference',
    links: [],
  },
  '/about': {
    title: 'About',
    hasLogo: false,
    showAuth: false,
    description: 'Project Information & Team',
    links: [],
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
    if (pathname.startsWith('/gazetteer')) {
      return sectionConfigs['/gazetteer']!;
    }
    if (pathname.startsWith('/gavoc')) {
      return sectionConfigs['/gavoc']!;
    }
    if (pathname.startsWith('/documentation')) {
      return sectionConfigs['/documentation']!;
    }
    if (pathname.startsWith('/about')) {
      return sectionConfigs['/about']!;
    }
    return sectionConfigs['/']!;
  };

  const config = getCurrentConfig();

  const getLinkClassName = (href: string) => {
    const isActive =
      (href === '/' && pathname === '/') ||
      (href === '/viewer' && pathname.startsWith('/viewer')) ||
      (href === '/gazetteer' && pathname.startsWith('/gazetteer')) ||
      (href === '/gavoc' && pathname.startsWith('/gavoc')) ||
      (href === '/documentation' && pathname.startsWith('/documentation')) ||
      (href === '/about' && pathname.startsWith('/about'));

    return isActive
      ? 'text-sm font-semibold text-primary px-2 py-1 rounded bg-muted/50'
      : 'text-sm font-medium text-muted-foreground hover:text-primary px-2 py-1 rounded hover:bg-muted/50';
  };

  return (
    <>
      {/* Main Navigation - always visible */}
      <nav className="bg-card border-b border-border shadow-sm">
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
                GAVOC
              </Link>
              <Link
                href="/documentation"
                className={getLinkClassName('/documentation')}
              >
                Docs
              </Link>
              <Link href="/about" className={getLinkClassName('/about')}>
                About
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
                  <h1 className="text-xl font-heading text-primary-foreground leading-tight">
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
                <h1 className="text-xl hidden sm:block font-heading text-primary-foreground">
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
                <li key={`link-${link.href}`} className="hidden sm:block">
                  {pathname.startsWith('/gavoc') && link.label === 'API' ? (
                    <Link
                      href={link.href}
                      className="inline-flex items-center space-x-1 font-medium text-primary-foreground hover:text-secondary px-3 py-1.5 rounded-md bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Code className="h-4 w-4" />
                      <span>{link.label}</span>
                    </Link>
                  ) : (
                    <Link
                      href={link.href}
                      className="font-medium text-primary-foreground hover:text-secondary"
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
