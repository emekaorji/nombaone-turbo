import 'server-only';

import type { OperatorRole } from '@nombaone/core-db/schema';

import { OperatorAuthError, requireOperator, type Operator } from '@/lib/auth/operator';

/**
 * PARADIGM — OPERATOR RBAC AS A STATIC CAPABILITY → ROLES MATRIX.
 *
 * Authorization for the panel is NOT a scatter of `if (role === 'super_admin')`
 * checks inside actions. It is one named map here: each CAPABILITY (a
 * `<area>:<action>` string) lists the operator ROLES that hold it. Actions ask a
 * single question — `operatorCan(role, capability)` — and never branch on the
 * role name directly. To change what a role may do you edit this one matrix; the
 * authorization surface stays auditable in a single place.
 *
 * Enforcement is SERVER-SIDE in the action layer (`requireCapability`), never
 * merely hiding a button in the UI. The four operator roles come from the
 * `operator_role` enum in `@nombaone/core-db` (`super_admin` | `operator` |
 * `support` | `viewer`); `super_admin` is the superset by construction.
 */

/** A free-form `<area>:<action>` permission string. */
export type OperatorCapability =
  | 'dashboard:read'
  | 'jobs:read'
  | 'jobs:trigger'
  | 'audit:read'
  | 'examples:read'
  | 'reconciliation:read';

/** Wildcard granting every capability — held by `super_admin`. */
const ALL = '*' as const;

/**
 * Single source of truth for what each operator role may do. `super_admin`
 * holds the wildcard; the rest list explicit capabilities. `viewer` is
 * read-only; `support` and `operator` add the guarded job trigger, which only
 * `operator` and `super_admin` may actually fire.
 */
const ROLE_CAPABILITIES: Record<OperatorRole, ReadonlyArray<OperatorCapability | typeof ALL>> = {
  // Full control, including the guarded ad-hoc job trigger.
  super_admin: [ALL],
  // Day-to-day operator: read everything, may trigger jobs.
  operator: [
    'dashboard:read',
    'jobs:read',
    'jobs:trigger',
    'audit:read',
    'examples:read',
    'reconciliation:read',
  ],
  // Support: read everything (incl. queue health) but cannot trigger jobs.
  support: ['dashboard:read', 'jobs:read', 'audit:read', 'examples:read', 'reconciliation:read'],
  // Viewer: read-only visibility, no queue/job control.
  viewer: ['dashboard:read', 'audit:read', 'examples:read', 'reconciliation:read'],
};

/**
 * The authorization predicate every action calls. `super_admin` (holding `*`)
 * passes everything; any other role passes only if the exact capability is
 * listed in its row.
 */
export function operatorCan(role: OperatorRole, capability: OperatorCapability): boolean {
  const grants = ROLE_CAPABILITIES[role];
  if (!grants) return false;
  return grants.includes(ALL) || grants.includes(capability);
}

/**
 * Mutation/read gate used by server actions: resolves the current operator
 * (throwing `unauthorized` if absent) and asserts they hold `capability`,
 * throwing `forbidden` otherwise. Returns the operator so the action can use it
 * (e.g. as the audit actor).
 */
export async function requireCapability(capability: OperatorCapability): Promise<Operator> {
  const operator = await requireOperator();
  if (!operatorCan(operator.role, capability)) {
    throw new OperatorAuthError(
      'forbidden',
      `Operator role '${operator.role}' is not authorised for '${capability}'.`
    );
  }
  return operator;
}
