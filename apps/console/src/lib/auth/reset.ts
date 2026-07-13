'use server';

import { createHash, randomBytes } from 'node:crypto';

import { and, eq, gt, isNull } from 'drizzle-orm';

import { orgSessionsTable, orgUsersTable, passwordResetTokensTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { hashPassword } from '@nombaone/sara/auth';

import { sendPasswordResetEmail } from '@/lib/mail';

import { headers } from 'next/headers';

/**
 * ── FORGOT PASSWORD ──────────────────────────────────────────────────────────
 *
 * There was no such flow. The `password_reset_tokens` table existed and not one line of
 * code referenced it — so a merchant who forgot their password was locked out of their
 * own revenue, permanently, with no way back in.
 *
 * Security properties, deliberately:
 *
 *  • NO ENUMERATION ORACLE. Requesting a reset returns the same success message whether
 *    or not the email has an account. Otherwise this endpoint becomes a free "does this
 *    person bank with you?" lookup for anyone who asks.
 *  • The token is stored HASHED (sha256), exactly like the invite token. A database
 *    leak must not hand over live reset links.
 *  • SINGLE USE. `consumed_at` is set in the same statement that claims it (a CAS), so
 *    two concurrent submissions cannot both reset the password.
 *  • SHORT LIVED — 1 hour.
 *  • Resetting a password REVOKES EVERY EXISTING SESSION. If someone reset because they
 *    believe they were compromised, leaving the attacker's session alive would make the
 *    reset theatre.
 */

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const MIN_PASSWORD_LENGTH = 10;

export const hashResetToken = (raw: string): string =>
  createHash('sha256').update(raw).digest('hex');

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:8010';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export type RequestResetState = { status: 'idle' } | { status: 'sent' } | { status: 'error'; message: string };

/**
 * Step 1 — "I forgot my password."
 *
 * Always reports success. An attacker must not be able to learn which email addresses
 * have accounts by watching this response.
 */
export async function requestPasswordResetAction(
  _prev: RequestResetState,
  formData: FormData
): Promise<RequestResetState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();

  if (!email || !email.includes('@')) {
    return { status: 'error', message: 'Enter the email address on your account.' };
  }

  const [user] = await db
    .select({ id: orgUsersTable.id, name: orgUsersTable.name })
    .from(orgUsersTable)
    .where(eq(orgUsersTable.email, email))
    .limit(1);

  // No account ⇒ send nothing, but SAY THE SAME THING. Never leak membership.
  if (!user) return { status: 'sent' };

  const rawToken = randomBytes(32).toString('base64url');
  await db.insert(passwordResetTokensTable).values({
    tokenHash: hashResetToken(rawToken),
    userId: user.id,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });

  const resetUrl = `${await baseUrl()}/reset-password/${rawToken}`;

  try {
    await sendPasswordResetEmail({ to: email, name: user.name, resetUrl });
  } catch {
    // The mail vendor failed. Do NOT leak that this address exists by reporting a
    // different outcome than the not-found case — the token is already stored, so a
    // retry works. (The transport logs the real error.)
    return { status: 'sent' };
  }

  return { status: 'sent' };
}

export type ResetState = { status: 'idle' } | { status: 'done' } | { status: 'error'; message: string };

/**
 * Step 2 — set the new password against a token from the email.
 *
 * The token is claimed with a CAS (`consumed_at IS NULL AND expires_at > now()`), so it
 * is single-use even under a double submit.
 */
export async function resetPasswordAction(
  token: string,
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { status: 'error', message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirm) {
    return { status: 'error', message: 'Those passwords do not match.' };
  }

  // CLAIM the token: single-use, unexpired, atomically.
  const [claimed] = await db
    .update(passwordResetTokensTable)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokensTable.tokenHash, hashResetToken(token)),
        isNull(passwordResetTokensTable.consumedAt),
        gt(passwordResetTokensTable.expiresAt, new Date())
      )
    )
    .returning({ userId: passwordResetTokensTable.userId });

  if (!claimed) {
    return {
      status: 'error',
      message: 'That reset link has expired or was already used. Request a new one.',
    };
  }

  await db
    .update(orgUsersTable)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(orgUsersTable.id, claimed.userId));

  // Revoke every existing session. If they reset because they think they were
  // compromised, leaving the attacker signed in would make this pointless.
  await db.delete(orgSessionsTable).where(eq(orgSessionsTable.userId, claimed.userId));

  return { status: 'done' };
}
