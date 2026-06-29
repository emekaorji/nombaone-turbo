import { NextResponse } from 'next/server';

import { OPERATOR_COOKIE, operatorCookieOptions } from '@/lib/auth/operator';

/**
 * Clear the operator session cookie. The sidebar calls this then hard-navigates
 * to `/sign-in` so the route gate re-evaluates with the cookie gone.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OPERATOR_COOKIE, '', operatorCookieOptions(0));
  return res;
}
