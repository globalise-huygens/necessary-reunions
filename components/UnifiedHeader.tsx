'use client';

import OrcidAuth from '@/components/OrcidAuth';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SectionConfig {
  title: string;
  hasLogo: boolean;
  logoSrc?: string;
  showAuth: boolean;
  links: Array<{
    href: string;
    label: string;
  }>;
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
    title: 'Grote Atlas Viewer',
    hasLogo: false,
    showAuth: false,
    links: [{ href: '/', label: 'Necessary Reunions' }],
  },
};

export function UnifiedHeader() {
  const pathname = usePathname();

  // Don't show header for viewer pages
  if (pathname.startsWith('/viewer')) {
    return null;
  }

  // Find the appropriate config based on the current path
  const getCurrentConfig = (): SectionConfig => {
    if (pathname.startsWith('/gazetteer')) return sectionConfigs['/gazetteer'];
    if (pathname.startsWith('/gavoc')) return sectionConfigs['/gavoc'];
    return sectionConfigs['/'];
  };

  const config = getCurrentConfig();

  return (
    <>
      {/* Main Navigation - always visible */}
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
                className="text-sm font-medium text-gray-600 hover:text-primary px-2 py-1 rounded hover:bg-gray-50"
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
                Grote Atlas
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Section-specific header */}
      <header className="bg-primary text-primary-foreground border-b border-border">
        <div className="w-full px-2 sm:px-4 flex flex-row items-center justify-between py-2 gap-2 sm:gap-0">
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
            <h1 className="text-xl hidden sm:block font-heading text-white">
              {config.title}
            </h1>
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
                  <Link
                    href={link.href}
                    className="font-medium text-white hover:text-secondary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
    </>
  );
}
