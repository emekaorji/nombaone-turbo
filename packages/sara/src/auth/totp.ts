import { authenticator } from 'otplib';

/**
 * PARADIGM — TOTP (RFC 6238) is a SHARED-SECRET second factor. Enrollment mints
 * a random base32 secret; the user scans an `otpauth://` URI into an authenticator
 * app; both sides then derive the same rolling 6-digit code from (secret, time).
 *
 * The secret is PII — it is stored ENCRYPTED at rest (see `@nombaone/sara/crypto`
 * + the `org_users.totp_secret_encrypted` column) and decrypted only at the
 * moment of verification. This module is pure crypto with no DB and no storage
 * concerns; the persistence/encryption decision lives in `users.ts`/`session.ts`.
 *
 * Verification uses a small time window so a code typed near a 30s boundary still
 * passes (clock skew tolerance), without widening the brute-force surface.
 */

// One step (±30s) of skew tolerance on each side of the current window.
authenticator.options = { window: 1 };

/** Mint a fresh base32 TOTP secret for a new enrollment. */
export const generateTotpSecret = (): string => authenticator.generateSecret();

/**
 * Build the `otpauth://totp/...` provisioning URI an authenticator app scans.
 * `label` is the human-facing account name (typically the user's email);
 * `nombaone` is the issuer shown in the app.
 */
export const buildTotpUri = (secret: string, label: string): string =>
  authenticator.keyuri(label, 'nombaone', secret);

/**
 * Verify a 6-digit code against the secret for the current time window. Returns
 * a boolean — the caller maps a `false` to AUTH_TOTP_INVALID. Never throws on a
 * malformed code; otplib treats it as a non-match.
 */
export const verifyTotp = (secret: string, code: string): boolean => {
  try {
    return authenticator.verify({ token: code, secret });
  } catch {
    return false;
  }
};
