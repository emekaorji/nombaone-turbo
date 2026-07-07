'use server';

import { orgUsersTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { verifyPassword, verifyTotp } from '@nombaone/sara/auth';
import { decryptPii } from '@nombaone/sara/crypto';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import {
  clearSessionCookie,
  createSession,
  readSessionCookie,
  revokeToken,
  setSessionCookie,
  setSessionMode,
  type SessionMode,
} from './session';
import { getSession } from './index';

/**
 * Login is two steps, second factor is a result not an error (auth spec §3.1):
 * password is verified first; if the account has TOTP the action returns
 * `totp_required` and the client reveals the code field. Wrong email, wrong
 * password, and wrong code collapse into ONE generic message so no per-factor
 * oracle leaks. On success a session cookie is set and we redirect into the shell.
 */
export type LoginState =
  | { status: 'idle' }
  | { status: 'totp_required' }
  | { status: 'error'; message: string };

const GENERIC = 'Those credentials do not match. Check your email and password.';

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  const totpCode = String(formData.get('totpCode') ?? '').trim();

  if (!email || !password) return { status: 'error', message: 'Enter your email and password.' };

  const rows = await db.select().from(orgUsersTable).where(eq(orgUsersTable.email, email)).limit(1);
  const user = rows[0];
  if (!user) return { status: 'error', message: GENERIC };

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) return { status: 'error', message: GENERIC };

  if (user.totpEnabled) {
    if (!totpCode) return { status: 'totp_required' };
    if (!user.totpSecretEncrypted) return { status: 'error', message: GENERIC };
    const secret = decryptPii(user.totpSecretEncrypted);
    if (!verifyTotp(secret, totpCode)) return { status: 'error', message: 'That code is invalid or expired.' };
  }

  const { token, expiresAt } = await createSession({
    userId: user.id,
    organizationId: user.organizationId,
    mode: 'sandbox',
  });
  await setSessionCookie(token, expiresAt);
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  const token = await readSessionCookie();
  if (token) await revokeToken(token);
  await clearSessionCookie();
  redirect('/login');
}

/** Flip the console's active ring; re-scopes every read on the next render. */
export async function setModeAction(mode: SessionMode): Promise<void> {
  const session = await getSession();
  if (session) await setSessionMode(session.sessionId, mode);
}
