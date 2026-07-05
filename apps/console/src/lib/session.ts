import 'server-only';

import { cookies } from 'next/headers';

import { validateSession } from './auth';
import { findUserById } from './auth';
import type { OrgUserRole } from '@nombaone/sara/auth';
import type { Mode } from '@nombaone/sara/context';

import { db } from './db';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from './session-cookie';

/**
 * The console session is a single httpOnly cookie holding an opaque token. The
 * token's sha256 hash is the lookup key on `org_sessions`; the raw token never
 * leaves the cookie. `getSession()` validates it against the DB on EVERY request
 * (the edge `proxy.ts` only checks presence) via `sara/auth.validateSession`.
 *
 * The session row also pins the user's ORG + the ring the session was opened in;
 * we resolve the user row for display/role and never trust org/role from the
 * client. The cookie name + lifetime live in the edge-safe `session-cookie.ts`
 * so the proxy can read them without importing this server-only module.
 */
export { SESSION_COOKIE };

export interface SessionUser {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: OrgUserRole;
}

export interface ActiveSession {
  user: SessionUser;
  /** The ring the session was opened in (pinned at login/signup). */
  mode: Mode;
}

/** Set the session cookie after a successful login / signup. */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Read the raw session token from the cookie (server-only). */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** Clear the session cookie (logout). */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Resolve the current session + user from the cookie, or `null` when absent /
 * invalid / expired. Resilient by design: any failure collapses to `null` rather
 * than throwing, so callers branch on absence; `requireUser()` turns that into a
 * redirect.
 */
export async function getSession(): Promise<ActiveSession | null> {
  const token = await getSessionToken();
  if (!token) return null;

  try {
    const validated = await validateSession(db, token);
    if (!validated) return null;

    const user = await findUserById(db, validated.userId);
    if (!user || user.organizationId !== validated.organizationId) return null;

    return {
      mode: validated.mode,
      user: {
        id: user.id,
        organizationId: user.organizationId,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  } catch {
    return null;
  }
}
