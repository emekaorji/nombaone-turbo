import 'server-only';

import { cookies } from 'next/headers';

import type { Mode } from '@nombaone/sara/context';

/**
 * The console's active sandbox/live mode is a per-browser PREFERENCE cookie, not an
 * authority: every domain read re-pins (org, mode) server-side from this value, and
 * the org is always the signed-in user's org. A tenant starts in `sandbox` (live
 * access is a later, deliberate gate), so the console default — and the fallback
 * when the cookie is absent/garbage — is `sandbox`.
 *
 * `parseEnvironment` / `ENV_COOKIE` import nothing server-only, so they stay
 * usable from anywhere; the `cookies()`-based reader is server-only.
 */

/** Cookie name holding the active console env ring. */
export const ENV_COOKIE = 'console_env';

/** Console default ring — `sandbox`, never `live` (see module doc). */
export const DEFAULT_ENVIRONMENT: Mode = 'sandbox';

/** Coerce an arbitrary string into a valid `Mode`, defaulting to `sandbox`. */
export function parseEnvironment(raw: string | null | undefined): Mode {
  return raw === 'live' ? 'live' : 'sandbox';
}

/** Read the active environment from the `console_env` cookie (server-only). */
export async function getEnvironment(): Promise<Mode> {
  const store = await cookies();
  return parseEnvironment(store.get(ENV_COOKIE)?.value);
}
