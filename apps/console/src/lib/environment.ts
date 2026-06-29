import 'server-only';

import { cookies } from 'next/headers';

import type { Environment } from '@nombaone/sara/context';

/**
 * The console's active test/live ring is a per-browser PREFERENCE cookie, not an
 * authority: every domain read re-pins (org, environment) server-side from this
 * value, and the org is always the signed-in user's org. A tenant starts in
 * `test` (live access is a later, deliberate gate), so the console default — and
 * the fallback when the cookie is absent/garbage — is `test`.
 *
 * `parseEnvironment` / `ENV_COOKIE` import nothing server-only, so they stay
 * usable from anywhere; the `cookies()`-based reader is server-only.
 */

/** Cookie name holding the active console env ring. */
export const ENV_COOKIE = 'console_env';

/** Console default ring — `test`, never `live` (see module doc). */
export const DEFAULT_ENVIRONMENT: Environment = 'test';

/** Coerce an arbitrary string into a valid `Environment`, defaulting to `test`. */
export function parseEnvironment(raw: string | null | undefined): Environment {
  return raw === 'live' ? 'live' : 'test';
}

/** Read the active environment from the `console_env` cookie (server-only). */
export async function getEnvironment(): Promise<Environment> {
  const store = await cookies();
  return parseEnvironment(store.get(ENV_COOKIE)?.value);
}
