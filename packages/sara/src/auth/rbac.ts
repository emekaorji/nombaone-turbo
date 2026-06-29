/**
 * PARADIGM — RBAC as a STATIC capability matrix. A role is not a bag of ad-hoc
 * `if (role === 'admin')` checks scattered across handlers; it is a named row in
 * one table here that maps a role to the set of capabilities it grants. Handlers
 * ask a single question — `can(role, capability)` — and never branch on the role
 * name directly. To change what a role can do, you edit this matrix and nothing
 * else; authorization stays auditable in one place.
 *
 * Capabilities are free-form strings (`<resource>:<action>`) so a feature can add
 * its own without touching the type. `owner` is the superset by construction.
 * This is intentionally simple: no per-resource ownership, no row-level rules —
 * those are documented seams a product layers on top, not platform primitives.
 */

export type OrgUserRole = 'owner' | 'admin' | 'developer' | 'viewer';

/** A free-form `<resource>:<action>` permission string (e.g. `apiKeys:create`). */
export type Capability = string;

/** Wildcard granting every capability — held by `owner`. */
const ALL: Capability = '*';

/**
 * The single source of truth for what each role may do. Generic platform verbs
 * only; products extend these strings as they ship features. A product layer can
 * still gate finer behaviour by checking richer capability strings against this
 * same matrix.
 */
const ROLE_CAPABILITIES: Record<OrgUserRole, readonly Capability[]> = {
  // Full control, including billing/danger-zone actions.
  owner: [ALL],
  // Operate the org day-to-day: manage members, keys, webhooks; not org deletion.
  admin: [
    'org:read',
    'members:read',
    'members:manage',
    'apiKeys:read',
    'apiKeys:manage',
    'webhooks:read',
    'webhooks:manage',
    'ledger:read',
  ],
  // Build against the platform: keys + webhooks + read access, no member admin.
  developer: [
    'org:read',
    'members:read',
    'apiKeys:read',
    'apiKeys:manage',
    'webhooks:read',
    'webhooks:manage',
    'ledger:read',
  ],
  // Read-only visibility.
  viewer: ['org:read', 'members:read', 'apiKeys:read', 'webhooks:read', 'ledger:read'],
};

/**
 * The authorization predicate every handler calls. `owner` (holding `*`) passes
 * everything; any other role passes only if the exact capability is listed.
 */
export const can = (role: OrgUserRole, capability: Capability): boolean => {
  const grants = ROLE_CAPABILITIES[role];
  if (!grants) return false;
  return grants.includes(ALL) || grants.includes(capability);
};
