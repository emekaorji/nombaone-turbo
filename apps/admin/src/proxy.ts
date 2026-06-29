import { NextResponse, type NextRequest } from 'next/server';

import { OPERATOR_COOKIE, verifyOperatorToken } from '@/lib/auth/operator';

/**
 * OPERATOR ROUTE GATE (Next 16 `proxy.ts` convention — formerly `middleware.ts`).
 *
 * Verifies the operator JWT on every dashboard route; an unauthenticated
 * request bounces to `/sign-in`, and a signed-in operator visiting `/sign-in`
 * bounces home. Runs on the EDGE runtime, so it does signature-only freshness
 * with `jose` (no DB, no bcrypt). The `tokenVersion` instant-revocation check
 * needs a DB read and therefore happens server-side in `getCurrentOperator`
 * (every privileged read/action) — the gate is the coarse first pass.
 */

const SIGN_IN_PATH = '/sign-in';

/** Asset / framework paths the gate ignores. */
function isPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/brand/') ||
    pathname === '/favicon.ico'
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicAsset(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(OPERATOR_COOKIE)?.value;
  let signedIn = false;
  if (token) {
    try {
      await verifyOperatorToken(token);
      signedIn = true;
    } catch {
      // Invalid / expired token is treated as no session.
    }
  }

  // The sign-in page: send authenticated operators home; let others through.
  if (pathname === SIGN_IN_PATH) {
    if (signedIn) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Every other route requires a valid operator token.
  if (!signedIn) {
    const url = req.nextUrl.clone();
    url.pathname = SIGN_IN_PATH;
    url.search = token ? '?expired=1' : '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand).*)'],
};
