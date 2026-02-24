'use client';

import { Globe } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

const LOCALES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'nl', label: 'Nederlands', short: 'NL' },
] as const;

export function LanguageToggle({ locale }: { locale: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSwitch = (targetLocale: string) => {
    if (targetLocale === locale) return;

    // Handle paths under [locale] routing: /en/documentation -> /nl/documentation
    // and the bare /documentation path
    let newPath: string;

    if (pathname.startsWith(`/${locale}/`)) {
      newPath = pathname.replace(`/${locale}/`, `/${targetLocale}/`);
    } else if (pathname === `/${locale}`) {
      newPath = `/${targetLocale}`;
    } else {
      // Bare path like /documentation - prepend locale
      newPath = `/${targetLocale}${pathname}`;
    }

    router.push(newPath);
  };

  return (
    <div className="flex items-center gap-1 print:hidden">
      <Globe size={16} className="text-muted-foreground mr-1" />
      {LOCALES.map((loc, index) => (
        <span key={`locale-${loc.code}`} className="flex items-center">
          {index > 0 && (
            <span className="text-muted-foreground/50 mx-0.5">|</span>
          )}
          <button
            onClick={() => handleSwitch(loc.code)}
            className={`px-1.5 py-0.5 text-xs font-medium rounded transition-colors ${
              locale === loc.code
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            aria-label={`Switch to ${loc.label}`}
            title={loc.label}
            type="button"
          >
            {loc.short}
          </button>
        </span>
      ))}
    </div>
  );
}
