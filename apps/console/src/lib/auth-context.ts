import 'server-only';

import { redirect } from 'next/navigation';

import { can } from '@nombaone/sara/auth';
import type { Capability } from '@nombaone/sara/auth';
import type { DomainContext } from '@nombaone/sara/context';

import { getEnvironment } from './environment';
import { getSession, type SessionUser } from './session';

/**
 * Server-component / server-action auth helpers. They compose `getSession()`
 * (cookie → DB validation) with the active-ring cookie so route code can ask for
 * exactly what it needs. The CLIENT NEVER SUPPLIES SCOPE — the organization comes
 * from the session row and the environment from the per-browser preference
 * cookie, both resolved here and re-pinned into the `DomainContext` every domain
 * read/write takes.
 *
 *   - `requireUser()`     → the signed-in user, or redirect to /login.
 *   - `requireCapability()` → user, asserting they hold an RBAC capability.
 *   - `getOrgDomainCtx()` → `{ organizationId, environment }` — the pinned scope.
 */

/** The signed-in user, or redirect to /login when there's no valid session. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session.user;
}

/**
 * Like `requireUser()` but additionally asserts the user's role holds `capability`
 * in the RBAC matrix (`sara/auth.can`). Redirects unauthenticated users to /login;
 * an authenticated-but-unauthorized user is sent to the overview (the UI also
 * hides what they can't do, but this is the server-side gate).
 */
export async function requireCapability(capability: Capability): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, capability)) redirect('/');
  return user;
}

/**
 * The pinned `DomainContext` threaded into every `@nombaone/sara` read/write.
 * `organizationId` is the signed-in user's org (from the session, never the
 * client); `environment` is the active ring preference. This is THE place scope
 * is assembled — a handler must never construct a ctx from request input.
 */
export async function getOrgDomainCtx(): Promise<DomainContext> {
  const [user, environment] = await Promise.all([requireUser(), getEnvironment()]);
  return { organizationId: user.organizationId, environment };
}
