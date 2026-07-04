import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { decryptPii } from '../crypto';
import { findUserByEmail } from './users';
import { verifyPassword } from './password';
import { verifyTotp } from './totp';
import { createSession } from './session';

import type { InfraTxDb } from '../context';

/**
 * PARADIGM — TWO-FACTOR LOGIN where the second factor is a RESULT, not an error.
 *
 * A login attempt has more than two outcomes, and the missing/again-required
 * second factor is a NORMAL branch of the protocol — not an exceptional failure.
 * So we model it as a discriminated union the caller switches on, rather than
 * throwing an "error" the UI has to catch to render its TOTP step:
 *
 *   { status: 'ok'; token }        → authenticated; session opened
 *   { status: 'totp_required' }    → password correct, TOTP enabled, code absent
 *
 * Genuinely-wrong credentials DO throw (AUTH_INVALID_CREDENTIALS) — and crucially
 * the password and the TOTP code collapse into the SAME generic error so the
 * caller cannot tell which factor failed (no oracle for credential stuffing).
 *
 * Order matters: verify the password FIRST; only a password-valid attempt is
 * ever told that TOTP is required, so the second-factor prompt itself never
 * leaks "this email + password is correct".
 */

export type LoginResult = { status: 'ok'; token: string } | { status: 'totp_required' };

const SESSION_ENVIRONMENT = 'sandbox' as const;

export const loginOrgUser = async (
  txDb: InfraTxDb,
  input: { email: string; password: string; totpCode?: string }
): Promise<LoginResult> => {
  const invalid = () =>
    AppError.Unauthorized(
      'Invalid email or password',
      undefined,
      NOMBAONE_ERROR_CODES.AUTH_INVALID_CREDENTIALS
    );

  const user = await findUserByEmail(txDb, input.email);
  // Always run the password verify shape; a missing user still throws the SAME
  // generic error. (bcrypt.compare against a non-hash simply returns false.)
  const passwordOk = user ? await verifyPassword(input.password, user.passwordHash) : false;
  if (!user || !passwordOk) {
    throw invalid();
  }

  if (user.totpEnabled) {
    // Password is correct but the second factor is outstanding.
    if (!input.totpCode) {
      return { status: 'totp_required' };
    }
    if (!user.totpSecretEncrypted) {
      // Flag set without a stored secret — treat as a generic failure, never 500.
      throw invalid();
    }
    const secret = decryptPii(user.totpSecretEncrypted);
    if (!verifyTotp(secret, input.totpCode)) {
      // Same generic error as a bad password: no per-factor oracle.
      throw invalid();
    }
  }

  const { token } = await createSession(txDb, {
    userId: user.id,
    organizationId: user.organizationId,
    mode: SESSION_ENVIRONMENT,
  });

  return { status: 'ok', token };
};
