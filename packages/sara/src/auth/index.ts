/**
 * `@nombaone/sara/auth` — CONSOLE / OPERATOR identity. This is the human-facing
 * authentication cluster (passwords, TOTP, opaque-token sessions, RBAC, tenant
 * signup, password reset), entirely distinct from `@nombaone/sara/api-keys`,
 * which authenticates machine callers of the public API.
 *
 * The cluster is composed of single-responsibility modules — each owns exactly
 * one secret-handling rule (hashing, TOTP crypto, token hashing, the RBAC
 * matrix) — and the higher-level flows (signup, login, password-reset) orchestrate
 * them so those invariants hold by construction. Apps import these verbs and never
 * touch the `org_users` / `org_sessions` tables directly.
 */
export * from './password';
export * from './totp';
export * from './session';
export * from './rbac';
export * from './users';
export * from './signup';
export * from './password-reset';
export * from './login';
