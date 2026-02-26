import { type NextRequest, NextResponse } from 'next/server';

const LOCALES = ['en', 'nl'] as const;
const DEFAULT_LOCALE = 'en';

function getPreferredLocale(request: NextRequest): string {
  const acceptLanguage = request.headers.get('accept-language') ?? '';
  for (const locale of LOCALES) {
    if (acceptLanguage.toLowerCase().includes(locale)) {
      return locale;
    }
  }
  return DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle bare /documentation path — redirect to locale-prefixed version
  if (pathname === '/documentation' || pathname.startsWith('/documentation/')) {
    const locale = getPreferredLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }

  // Handle locale-prefixed documentation paths — rewrite to [locale] route
  const localeMatch = pathname.match(/^\/(en|nl)(\/documentation(?:\/.*)?)?$/);
  if (localeMatch) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|image/).*)'],
};
