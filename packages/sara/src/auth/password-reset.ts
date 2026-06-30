import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';

import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { passwordResetTokensTable } from '@nombaone/core-db/schema';

import { findUserByEmail, updateUserPassword } from './users';

import type { InfraDb, InfraTxDb } from '../context';

/**
 * PARADIGM — single-use, hashed, expiring reset tokens with NO user enumeration.
 *
 *  • Enumeration-safe: `requestPasswordReset` returns void regardless of whether
 *    the email exists. A caller (and therefore an attacker) cannot distinguish a
 *    registered email from an unregistered one; the delivery side-channel (email)
 *    is the only thing that fires, and only for real accounts.
 *  • At-rest safe: like sessions, only the SHA-256 hash of the token is stored.
 *    The raw token travels solely inside the reset link we email the user.
 *  • Single-use + expiring: a token is valid only while unconsumed AND unexpired;
 *    `resetPassword` stamps `consumedAt` in the SAME transaction that changes the
 *    password, so a replayed link is inert.
 *
 * Emitting the actual email is a documented SEAM — `requestPasswordReset` returns
 * the freshly minted raw token to its caller (the app wires it into an email
 * template + transport). It is never persisted in the clear.
 */

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const mintRawToken = (): string => randomBytes(32).toString('base64url');
const hashToken = (rawToken: string): string =>
  createHash('sha256').update(rawToken).digest('hex');

/**
 * Begin a reset. For a known email, mint + persist a hashed token and return the
 * RAW token for the caller to email; for an unknown email, do nothing observable.
 * The return value is intentionally `void`-shaped at the contract boundary: it
 * yields a token only as the delivery seam, never a signal of account existence.
 */
export const requestPasswordReset = async (
  db: InfraDb,
  email: string
): Promise<{ token: string } | void> => {
  const user = await findUserByEmail(db, email);
  if (!user) return; // enumeration-safe no-op

  const token = mintRawToken();
  await db.insert(passwordResetTokensTable).values({
    tokenHash: hashToken(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });

  return { token };
};

/**
 * Complete a reset: validate the token (unconsumed + unexpired), set the new
 * password, and consume the token — atomically, so a stolen-and-replayed link is
 * dead the instant the first use commits. An invalid/expired/used token raises
 * AUTH_RESET_TOKEN_INVALID with no detail about which condition failed.
 */
export const resetPassword = async (
  txDb: InfraTxDb,
  token: string,
  newPassword: string
): Promise<void> => {
  await txDb.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.tokenHash, hashToken(token)),
          isNull(passwordResetTokensTable.consumedAt),
          gt(passwordResetTokensTable.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!row) {
      throw AppError.BadRequest(
        'This password reset link is invalid or has expired',
        undefined,
        NOMBAONE_ERROR_CODES.AUTH_RESET_TOKEN_INVALID
      );
    }

    await updateUserPassword(tx, row.userId, newPassword);
    await tx
      .update(passwordResetTokensTable)
      .set({ consumedAt: new Date() })
      .where(eq(passwordResetTokensTable.id, row.id));
  });
};
