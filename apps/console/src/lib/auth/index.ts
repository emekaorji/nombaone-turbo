import { cache } from 'react';

import { redirect } from 'next/navigation';

import { type ConsoleSession, readSessionCookie, validateToken } from './session';

/**
 * Per-request session accessor for server components/actions. `cache()` dedupes
 * the cookie read + DB validation so the layout, sidebar, and page share one
 * lookup per render.
 */
export const getSession = cache(async (): Promise<ConsoleSession | null> => {
  const token = await readSessionCookie();
  if (!token) return null;
  return validateToken(token);
});

/** Guard for the authed shell: resolve the session or bounce to /login. */
export async function requireSession(): Promise<ConsoleSession> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export type { ConsoleSession, SessionMode } from './session';
