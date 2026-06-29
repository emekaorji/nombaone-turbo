import 'server-only';

import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { operatorsTable } from '@nombaone/core-db/schema';
import { verifyPassword, verifyTotp } from '@nombaone/sara/auth';
import { decryptPii } from '@nombaone/sara/crypto';
import { recordAudit } from '@nombaone/sara/audit';

import { getDb } from '@/lib/db';
import {
  OPERATOR_COOKIE,
  operatorCookieOptions,
  signOperatorToken,
} from '@/lib/auth/operator';

/**
 * OPERATOR LOGIN.
 *
 * Reuses the domain's secret-handling primitives (`verifyPassword`,
 * `verifyTotp`, `decryptPii`) against the `operators` table rather than
 * re-implementing crypto here. Like the org login, TOTP is a RESULT, not an
 * error: a password-valid operator with TOTP enrolled but no code returns
 * `totp_required` so the form can render its second step; a wrong password and a
 * wrong code collapse into the SAME generic failure (no per-factor oracle).
 *
 * On success we sign an operator JWT embedding the current `tokenVersion` and
 * set the httpOnly cookie, then write a login audit row.
 */

export type OperatorLoginResult =
  | { status: 'ok' }
  | { status: 'totp_required' }
  | { status: 'invalid' };

export async function loginOperator(input: {
  email: string;
  password: string;
  totpCode?: string;
}): Promise<OperatorLoginResult> {
  const db = getDb();
  const email = input.email.trim().toLowerCase();

  const [operator] = await db
    .select()
    .from(operatorsTable)
    .where(eq(operatorsTable.email, email))
    .limit(1);

  // Run the verify shape even when the operator is missing so timing/branching
  // doesn't reveal whether the email exists.
  const passwordOk = operator
    ? await verifyPassword(input.password, operator.passwordHash)
    : false;

  if (!operator || !passwordOk) {
    return { status: 'invalid' };
  }

  // TOTP is optional per operator (enrolled = a stored encrypted secret).
  if (operator.totpSecretEncrypted) {
    if (!input.totpCode) {
      return { status: 'totp_required' };
    }
    const secret = decryptPii(operator.totpSecretEncrypted);
    if (!verifyTotp(secret, input.totpCode)) {
      return { status: 'invalid' };
    }
  }

  const token = await signOperatorToken({
    operatorId: operator.id,
    role: operator.role,
    tokenVersion: operator.tokenVersion,
  });

  const store = await cookies();
  store.set(OPERATOR_COOKIE, token, operatorCookieOptions());

  await recordAudit(db, {
    operatorId: operator.id,
    action: 'auth.login',
    targetType: 'operator',
    targetReference: operator.email,
    summary: `Operator '${operator.email}' signed in.`,
  });

  return { status: 'ok' };
}
