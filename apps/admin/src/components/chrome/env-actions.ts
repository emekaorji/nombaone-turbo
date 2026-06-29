'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import type { Environment } from '@nombaone/sara/context';

import { requireOperator } from '@/lib/auth/operator';
import { ENV_COOKIE, envCookieOptions } from '@/lib/env';

/**
 * Persist the operator's environment PREFERENCE (test|live) and revalidate the
 * whole tree so every scoped read re-derives the ring server-side. This is a
 * preference, not authority: it only requires a signed-in operator (no extra
 * capability), and reads always re-filter by it server-side.
 */
export async function setEnvironment(environment: Environment): Promise<void> {
  // A valid operator is required to set a preference, but no capability gate —
  // choosing which ring to view is not a privileged action.
  await requireOperator();
  const store = await cookies();
  store.set(ENV_COOKIE, environment, envCookieOptions());
  revalidatePath('/', 'layout');
}
