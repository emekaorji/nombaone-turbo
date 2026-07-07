'use server';

import { organizationsTable, orgUsersTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { db as poolDb } from '@nombaone/core-db/pool';
import { hashPassword, verifyPassword, verifyTotp } from '@nombaone/sara/auth';
import { decryptPii } from '@nombaone/sara/crypto';
import { mintReference } from '@nombaone/sara/reference';
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

/**
 * Tenant GENESIS — self-serve merchant signup (owned by apps/console per the auth
 * spec; the api never runs this). Atomically creates the organization + its owner
 * user, opens a session in SANDBOX mode, and drops the new merchant into onboarding.
 * Email is globally unique; a duplicate is reported, never a per-account oracle.
 */
export type SignupState = { status: 'idle' } | { status: 'error'; message: string };

export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const businessName = String(formData.get('businessName') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!name || !email || !businessName) return { status: 'error', message: 'Enter your name, work email, and business name.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { status: 'error', message: 'Enter a valid email address.' };
  if (password.length < 8) return { status: 'error', message: 'Use a password with at least 8 characters.' };

  const passwordHash = await hashPassword(password);

  // The `org_users_email_unique` constraint is the single source of truth for email
  // uniqueness (no separate pre-check to race or cold-start on). Everything lands in
  // one pooled transaction; a duplicate surfaces as a 23505 we translate to a message.
  let genesis: { userId: string; organizationId: string };
  try {
    genesis = await poolDb.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizationsTable)
        .values({ reference: mintReference('ORG'), name: businessName })
        .returning();
      if (!org) throw new Error('org insert failed');
      const [user] = await tx
        .insert(orgUsersTable)
        .values({ reference: mintReference('USR'), organizationId: org.id, email, name, passwordHash, role: 'owner' })
        .returning();
      if (!user) throw new Error('user insert failed');
      return { userId: user.id, organizationId: org.id };
    });
  } catch (e) {
    const cause = (e as { cause?: { code?: string } })?.cause;
    const msg = e instanceof Error ? e.message : String(e);
    if (cause?.code === '23505' || /org_users_email_unique|duplicate key/i.test(msg)) {
      return { status: 'error', message: 'An account with this email already exists. Sign in instead.' };
    }
    return { status: 'error', message: 'We could not create your account. Please try again.' };
  }

  const { token, expiresAt } = await createSession({ userId: genesis.userId, organizationId: genesis.organizationId, mode: 'sandbox' });
  await setSessionCookie(token, expiresAt);
  redirect('/onboarding');
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
