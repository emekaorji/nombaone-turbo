/**
 * `@nombaone/sara/auth` — reusable AUTH PRIMITIVES (product-agnostic): password
 * hashing, TOTP crypto, and the RBAC predicate + capability/role types. The auth
 * WORKFLOWS (signup, login, sessions, users, password reset) live in the app that
 * owns them (apps/console for the merchant dashboard; apps/admin for operators).
 */
export * from './password';
export * from './totp';
export * from './rbac';
