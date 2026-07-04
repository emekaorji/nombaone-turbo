'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import type { Mode } from '@nombaone/sara/context';

import { ENV_COOKIE, parseEnvironment } from './environment';

/**
 * PARADIGM — the env switch is a COOKIE + a server-side re-check + a root
 * `revalidatePath('/')`. The client island calls this to flip the active ring;
 * it never sends the ring as part of a domain request. We persist the preference
 * to the `console_env` cookie, then revalidate the whole tree so every RSC
 * re-reads its scope through `getOrgDomainCtx()` and re-renders the now-active
 * ring's data. The cookie carries NO authority — reads re-pin (org, env)
 * server-side on every request.
 */
export async function switchEnvironment(next: Mode): Promise<void> {
  const environment = parseEnvironment(next);
  const store = await cookies();
  store.set(ENV_COOKIE, environment, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath('/', 'layout');
}
