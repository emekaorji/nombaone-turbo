import { can } from '@nombaone/sara/auth';
import type { Capability, OrgUserRole } from '@nombaone/sara/auth';

/**
 * Thin console-side re-export of the domain RBAC predicate so UI islands can
 * gate affordances (hide a "Create" button, disable a destructive action) using
 * the SAME matrix the server enforces in `requireCapability`. The matrix itself
 * lives in `@nombaone/sara/auth` — this never re-declares it, it only forwards.
 *
 * Hiding in the UI is a courtesy, not the gate: every mutation re-checks the
 * capability server-side in its action before touching the domain.
 */
export { can };
export type { Capability, OrgUserRole };

/** Human label for a role, for badges / member lists. */
export const ROLE_LABEL: Record<OrgUserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  developer: 'Developer',
  viewer: 'Viewer',
};
