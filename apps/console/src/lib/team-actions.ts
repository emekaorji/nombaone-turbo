'use server';

import { randomBytes } from 'node:crypto';

import { orgInvitationsTable, orgUsersTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { db as poolDb } from '@nombaone/core-db/pool';
import { can, hashPassword, type OrgUserRole } from '@nombaone/sara/auth';
import { mintReference } from '@nombaone/sara/reference';
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { getSession } from '@/lib/auth';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { getInvitationByToken, hashInviteToken } from '@/lib/team';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVITABLE_ROLES: OrgUserRole[] = ['admin', 'developer', 'viewer'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteState = { error?: string; link?: string; email?: string };

async function inviteBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:8010';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function inviteTeammateAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const session = await getSession();
  if (!session) return { error: 'Your session has expired. Sign in again.' };
  if (!can(session.user.role as OrgUserRole, 'members:manage')) {
    return { error: 'You do not have permission to invite teammates.' };
  }

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'developer') as OrgUserRole;
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' };
  if (!INVITABLE_ROLES.includes(role)) return { error: 'Pick a role (admin, developer, or viewer).' };

  const [existingUser] = await db.select({ id: orgUsersTable.id }).from(orgUsersTable).where(eq(orgUsersTable.email, email));
  if (existingUser) return { error: 'That email already has an account.' };

  const [existingInvite] = await db
    .select({ id: orgInvitationsTable.id })
    .from(orgInvitationsTable)
    .where(
      and(
        eq(orgInvitationsTable.organizationId, session.organizationId),
        eq(orgInvitationsTable.email, email),
        eq(orgInvitationsTable.status, 'pending'),
      ),
    );
  if (existingInvite) return { error: 'There is already a pending invite for that email.' };

  const rawToken = randomBytes(32).toString('base64url');
  await db.insert(orgInvitationsTable).values({
    reference: mintReference('IVT'),
    organizationId: session.organizationId,
    email,
    role,
    tokenHash: hashInviteToken(rawToken),
    invitedByUserId: session.userId,
    status: 'pending',
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  revalidatePath('/settings');
  revalidatePath('/settings/team');
  const base = await inviteBaseUrl();
  return { link: `${base}/invite/${rawToken}`, email };
}

export async function revokeInvitationAction(reference: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Your session has expired.' };
  if (!can(session.user.role as OrgUserRole, 'members:manage')) {
    return { error: 'You do not have permission to manage invites.' };
  }

  await db
    .update(orgInvitationsTable)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(
      and(
        eq(orgInvitationsTable.organizationId, session.organizationId),
        eq(orgInvitationsTable.reference, reference),
        eq(orgInvitationsTable.status, 'pending'),
      ),
    );

  revalidatePath('/settings');
  revalidatePath('/settings/team');
  return {};
}

export type AcceptState = { error?: string };

export async function acceptInvitationAction(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const token = String(formData.get('token') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (name.length < 2) return { error: 'Enter your name.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };

  const invitation = await getInvitationByToken(token);
  if (!invitation.valid || !invitation.email || !invitation.role) {
    return { error: 'This invite is no longer valid.' };
  }

  const passwordHash = await hashPassword(password);
  const tokenHash = hashInviteToken(token);

  let created: { userId: string; organizationId: string } | null;
  try {
    created = await poolDb.transaction(async (tx) => {
      // Re-read under the tx and lock the row to close the accept/revoke race.
      const [inv] = await tx
        .select({
          id: orgInvitationsTable.id,
          organizationId: orgInvitationsTable.organizationId,
          email: orgInvitationsTable.email,
          role: orgInvitationsTable.role,
          status: orgInvitationsTable.status,
          expiresAt: orgInvitationsTable.expiresAt,
        })
        .from(orgInvitationsTable)
        .where(eq(orgInvitationsTable.tokenHash, tokenHash))
        .for('update');

      if (!inv || inv.status !== 'pending' || inv.expiresAt < new Date()) {
        throw new Error('invalid_invite');
      }

      const [inserted] = await tx
        .insert(orgUsersTable)
        .values({
          reference: mintReference('USR'),
          organizationId: inv.organizationId,
          email: inv.email,
          name,
          role: inv.role,
          passwordHash,
        })
        .returning({ id: orgUsersTable.id });

      await tx
        .update(orgInvitationsTable)
        .set({ status: 'accepted', acceptedAt: new Date(), updatedAt: new Date() })
        .where(eq(orgInvitationsTable.id, inv.id));

      return { userId: inserted.id, organizationId: inv.organizationId };
    });
  } catch {
    created = null;
  }

  if (!created) return { error: 'This invite is no longer valid.' };

  const { token: sessionToken, expiresAt } = await createSession({
    userId: created.userId,
    organizationId: created.organizationId,
    mode: 'sandbox',
  });
  await setSessionCookie(sessionToken, expiresAt);

  redirect('/');
}
