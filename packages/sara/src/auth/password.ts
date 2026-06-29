import bcrypt from 'bcryptjs';

/**
 * PARADIGM — passwords are NEVER stored or compared in the clear. We keep only a
 * one-way bcrypt hash; verification re-derives from the candidate and compares
 * via bcrypt's own constant-time check. bcrypt embeds its cost factor + per-hash
 * salt INSIDE the stored string, so there is no separate salt column and the
 * cost can be raised over time without a migration (old hashes still verify).
 *
 * This module is deliberately tiny and framework-free: it is the single place
 * that knows how a password becomes a hash, so the rule "plaintext never leaves
 * this function" is enforceable by inspection.
 */

/** Work factor. Higher = slower (more brute-force resistant) at login cost. */
const BCRYPT_COST = 12;

/** Hash a plaintext password for at-rest storage in `org_users.password_hash`. */
export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, BCRYPT_COST);

/**
 * Verify a candidate against a stored hash. Returns a boolean (not a throw) so
 * the caller decides the failure semantics — login raises AUTH_INVALID_CREDENTIALS,
 * a password-change flow raises AUTH_PASSWORD_INCORRECT. bcrypt.compare is
 * constant-time with respect to the hash, so it leaks no timing signal.
 */
export const verifyPassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);
