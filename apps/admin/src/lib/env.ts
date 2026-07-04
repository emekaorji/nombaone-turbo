import 'server-only';

import { cookies } from 'next/headers';
import type { Mode } from '@nombaone/sara/context';

/**
 * PARADIGM — STAFF ENVIRONMENT IS A PREFERENCE, NOT AUTHORITY.
 *
 * Operators view platform data scoped to one mode at a time (`sandbox` | `live`).
 * The default is `live` — staff care about production first. The selected ring
 * is stored in a NON-httpOnly preference cookie so a client island can flip it
 * without a round-trip; CRUCIALLY it is NOT a security boundary. Every read in
 * every screen re-derives the environment from this cookie SERVER-SIDE and
 * filters the query by it. The cookie cannot grant access to anything — an
 * operator already authenticated by their JWT (see `auth/operator.ts`) simply
 * chooses which ring's rows to look at; RBAC (`rbac.ts`) governs *whether* they
 * may look at all.
 *
 * Because it is a preference and not authority, an unparsable / tampered value
 * silently falls back to the `live` default rather than throwing.
 */

export const ENV_COOKIE = 'nombaone_env';

/** The default ring staff land on. */
export const DEFAULT_ENVIRONMENT: Mode = 'live';

function isEnvironment(value: string | undefined): value is Mode {
  return value === 'sandbox' || value === 'live';
}

/**
 * Read the operator's selected environment from the preference cookie, falling
 * back to the `live` default. Called server-side by every scoped read so the
 * filter is always re-derived, never trusted from the client.
 */
export async function getSelectedEnvironment(): Promise<Mode> {
  const raw = (await cookies()).get(ENV_COOKIE)?.value;
  return isEnvironment(raw) ? raw : DEFAULT_ENVIRONMENT;
}

/** Non-httpOnly so the client switcher can update it; not a security boundary. */
export function envCookieOptions() {
  return {
    httpOnly: false,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  };
}
