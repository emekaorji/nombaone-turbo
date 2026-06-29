import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE } from '@/lib/session-cookie';

/**
 * Console gate. A fast cookie-presence check on every protected route — it does
 * NOT validate the session (no DB at the edge). Real validation (token → DB →
 * user) happens in `(app)/layout.tsx` via `getSession()`. This is purely a cheap
 * redirect so signed-out visitors hit `/login` immediately instead of rendering
 * a protected route that then redirects.
 *
 * Next 16 renamed `middleware.ts` to `proxy.ts` (the file convention) and the
 * exported function from `middleware` to `proxy` — mirrors apps/admin. Same
 * NextRequest / NextResponse APIs.
 */

/** Route prefixes that never require a session (the auth route group). */
const PUBLIC_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/accept-invite',
  '/verify-2fa',
  '/enroll-2fa',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return withSecurityHeaders(NextResponse.next());
  }

  if (!req.cookies.has(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    /**
     * Run on every path except Next internals + static asset prefixes. The
     * handler does the finer "is this a public auth page" check so the matcher
     * can stay broad.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
