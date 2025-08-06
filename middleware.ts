import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const subdomain = hostname.split('.')[0];

  if (subdomain === 'viewer') {
    return NextResponse.rewrite(
      new URL('/viewer' + request.nextUrl.pathname, request.url),
    );
  }

  if (subdomain === 'gavoc') {
    return NextResponse.rewrite(
      new URL('/gavoc' + request.nextUrl.pathname, request.url),
    );
  }

  if (subdomain === 'gazetteer') {
    return NextResponse.rewrite(
      new URL('/gazetteer' + request.nextUrl.pathname, request.url),
    );
  }

  if (
    request.nextUrl.pathname.startsWith('/viewer') ||
    request.nextUrl.pathname.startsWith('/gavoc') ||
    request.nextUrl.pathname.startsWith('/gazetteer')
  ) {
    return NextResponse.next();
  }

  return NextResponse.next();
}
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|image/).*)'],
};
