import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

/**
 * ── Scope gating ──────────────────────────────────────────────────────────
 * An API key carries a flat list of OPAQUE scope strings (e.g. `example:read`,
 * `webhooks:write`). A scope is just a `<resource>:<action>` convention; the
 * domain never branches on a key's *name*, only on whether a required scope is
 * present. Endpoints declare the scope they need and call {@link requireScope}
 * against the already-verified key — the handler NEVER reads a scope supplied by
 * the client, only the set materialised by {@link verifyApiKey}.
 *
 * Scopes are intentionally string-typed here (not the contract's `ApiKeyScope`
 * enum) so this primitive stays product-agnostic: new domains add scope strings
 * without touching this file. Authoritative scope vocabulary lives in
 * `@nombaone/core-contracts` and is validated at the request boundary.
 */

/** A verified key, narrowed to the only thing scope-checking cares about. */
export interface ScopedKey {
  scopes: string[];
}

/**
 * Throw `API_KEY_SCOPE_FORBIDDEN` unless `verified` holds `scope`. This is a
 * pure authorization guard — no I/O — so it is cheap to call at the top of every
 * scoped handler.
 */
export function requireScope(verified: ScopedKey, scope: string): void {
  if (!verified.scopes.includes(scope)) {
    throw AppError.Forbidden(
      `API key is missing the required scope "${scope}"`,
      { requiredScope: scope, grantedScopes: verified.scopes },
      NOMBAONE_ERROR_CODES.API_KEY_SCOPE_FORBIDDEN
    );
  }
}

/** True when `verified` holds every scope in `scopes`. Convenience for callers
 * that branch on capability rather than hard-failing. */
export function hasScopes(verified: ScopedKey, scopes: string[]): boolean {
  return scopes.every((scope) => verified.scopes.includes(scope));
}
